import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try { await requireAuth(req); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  const { searchParams } = req.nextUrl;
  const productId = searchParams.get('productId');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const search = searchParams.get('search');
  const page = Number(searchParams.get('page') || '1');
  const limit = 50;

  const supplierId = searchParams.get('supplierId');
  const where: Record<string, unknown> = {};
  if (productId) where.variant = { productId };
  if (supplierId) where.supplierId = supplierId;
  if (from || to) {
    where.createdAt = {};
    if (from) (where.createdAt as Record<string, Date>).gte = new Date(from);
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      (where.createdAt as Record<string, Date>).lte = toDate;
    }
  }
  if (search) {
    where.OR = [
      { variant: { name: { contains: search } } },
      { variant: { product: { name: { contains: search } } } },
      { notes: { contains: search } },
    ];
  }

  const [sales, total] = await Promise.all([
    prisma.sale.findMany({
      where,
      include: {
        variant: { include: { product: { select: { id: true, name: true } } } },
        location: true,
        returns: true,
        order: { select: { id: true, customerName: true, customerEmail: true } },
        supplier: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.sale.count({ where }),
  ]);

  return NextResponse.json({ sales, total, page, pages: Math.ceil(total / limit) });
}

export async function POST(req: NextRequest) {
  let userId: string;
  try { userId = await requireAuth(req); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  const { variantId, locationId, quantity, unitSalePrice, unitCostPrice, unitShippingCost, notes, supplierId } = await req.json();
  if (!variantId || !locationId || !quantity) {
    return NextResponse.json({ error: 'variantId, locationId et quantity requis' }, { status: 400 });
  }
  const qty = Number(quantity);
  if (qty <= 0) return NextResponse.json({ error: 'Quantité invalide' }, { status: 400 });

  // Fetch variant + active promotions + supplier price
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    include: {
      promotions: true,
      supplierPrices: supplierId ? { where: { supplierId } } : false,
    },
  });
  if (!variant) return NextResponse.json({ error: 'Variante introuvable' }, { status: 404 });

  // Base prices: supplier-specific if available, else variant defaults
  const supplierPrice = supplierId ? (variant as { supplierPrices?: { salePrice: number; costPrice: number; shippingCost: number; vatRate: number }[] }).supplierPrices?.[0] : null;
  const baseSalePrice    = supplierPrice?.salePrice    ?? variant.salePrice;
  const baseCostPrice    = supplierPrice?.costPrice    ?? variant.costPrice;
  const baseShippingCost = supplierPrice?.shippingCost ?? variant.shippingCost;
  const baseVatRate      = supplierPrice?.vatRate      ?? variant.vatRate;

  // Determine effective sale price: active promo (for this supplier or global) > client-provided > base
  const now = new Date();
  const activePromo = variant.promotions.find(p => {
    // Match supplier-specific promo first, then global (no supplier)
    if (supplierId && p.supplierId && p.supplierId !== supplierId) return false;
    if (!supplierId && p.supplierId) return false;
    const start = new Date(p.startDate); start.setUTCHours(0, 0, 0, 0);
    const end = p.endDate ? new Date(p.endDate) : null; if (end) end.setUTCHours(23, 59, 59, 999);
    return start <= now && (!end || end >= now);
  }) || null;
  const effectiveSalePrice = activePromo ? activePromo.price : Number(unitSalePrice ?? baseSalePrice);

  // Check stock
  const stock = await prisma.stock.findUnique({
    where: { variantId_locationId: { variantId, locationId } },
  });
  if (!stock || stock.quantity < qty) {
    return NextResponse.json({ error: 'Stock insuffisant' }, { status: 400 });
  }

  const [sale] = await prisma.$transaction([
    prisma.sale.create({
      data: {
        variantId,
        locationId,
        supplierId: supplierId || null,
        quantity: qty,
        unitSalePrice: effectiveSalePrice,
        unitCostPrice: Number(unitCostPrice ?? baseCostPrice),
        unitShippingCost: Number(unitShippingCost ?? baseShippingCost),
        vatRate: baseVatRate,
        notes: notes?.trim() || null,
      },
    }),
    prisma.stock.update({
      where: { variantId_locationId: { variantId, locationId } },
      data: { quantity: { decrement: qty } },
    }),
  ]);

  // Log stock movement (non-blocking)
  prisma.stockMovement.create({
    data: { variantId, locationId, type: 'sale', delta: -qty, userId, ref: sale.id },
  }).catch(() => {});

  return NextResponse.json(sale, { status: 201 });
}
