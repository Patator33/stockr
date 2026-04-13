import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try { await requireAuth(req); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  const { searchParams } = req.nextUrl;
  const productId = searchParams.get('productId');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const page = Number(searchParams.get('page') || '1');
  const limit = 50;

  const where: Record<string, unknown> = {};
  if (productId) where.variant = { productId };
  if (from || to) {
    where.createdAt = {};
    if (from) (where.createdAt as Record<string, Date>).gte = new Date(from);
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      (where.createdAt as Record<string, Date>).lte = toDate;
    }
  }

  const [sales, total] = await Promise.all([
    prisma.sale.findMany({
      where,
      include: {
        variant: { include: { product: { select: { id: true, name: true } } } },
        location: true,
        returns: true,
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
  try { await requireAuth(req); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  const { variantId, locationId, quantity, unitSalePrice, unitCostPrice, unitShippingCost, notes } = await req.json();
  if (!variantId || !locationId || !quantity) {
    return NextResponse.json({ error: 'variantId, locationId et quantity requis' }, { status: 400 });
  }
  const qty = Number(quantity);
  if (qty <= 0) return NextResponse.json({ error: 'Quantité invalide' }, { status: 400 });

  // Fetch variant + active promotion
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    include: { promotions: true },
  });
  if (!variant) return NextResponse.json({ error: 'Variante introuvable' }, { status: 404 });

  // Determine effective sale price: active promo > client-provided > variant default
  const now = new Date();
  const activePromo = variant.promotions.find(p => {
    const start = new Date(p.startDate); start.setUTCHours(0, 0, 0, 0);
    const end = p.endDate ? new Date(p.endDate) : null; if (end) end.setUTCHours(23, 59, 59, 999);
    return start <= now && (!end || end >= now);
  }) || null;
  const effectiveSalePrice = activePromo ? activePromo.price : Number(unitSalePrice ?? variant.salePrice);

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
        quantity: qty,
        unitSalePrice: effectiveSalePrice,
        unitCostPrice: Number(unitCostPrice ?? variant.costPrice),
        unitShippingCost: Number(unitShippingCost ?? variant.shippingCost),
        vatRate: variant.vatRate,
        notes: notes?.trim() || null,
      },
    }),
    prisma.stock.update({
      where: { variantId_locationId: { variantId, locationId } },
      data: { quantity: { decrement: qty } },
    }),
  ]);

  return NextResponse.json(sale, { status: 201 });
}
