import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try { await requireAuth(req); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  const productId = req.nextUrl.searchParams.get('productId');
  const barcode = req.nextUrl.searchParams.get('barcode');
  const supplierRef = req.nextUrl.searchParams.get('supplierRef');
  const now = new Date();
  const withActivePromo = (v: { promotions: { id: string; price: number; startDate: Date | string; endDate: Date | string | null; variantId: string; createdAt: Date | string }[] }) => {
    const active = v.promotions.find(p => {
      // Normalize startDate to beginning of UTC day
      const start = new Date(p.startDate);
      start.setUTCHours(0, 0, 0, 0);
      // Normalize endDate to end of UTC day so "today" stays active all day
      const end = p.endDate ? new Date(p.endDate) : null;
      if (end) end.setUTCHours(23, 59, 59, 999);
      return start <= now && (!end || end >= now);
    }) || null;
    return { ...v, activePromotion: active };
  };

  if (barcode || supplierRef) {
    const where = barcode ? { barcode } : { supplierRef: supplierRef! };
    const variant = await prisma.productVariant.findUnique({
      where,
      include: { stocks: { include: { location: true } }, product: true, promotions: true, supplierPrices: { include: { supplier: true } } },
    });
    if (!variant) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(withActivePromo(variant));
  }
  const where = productId ? { productId } : {};
  const variants = await prisma.productVariant.findMany({
    where,
    include: { stocks: { include: { location: true } }, promotions: true, product: { select: { defaultLocationId: true } }, supplierPrices: { include: { supplier: true } } },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json(variants.map(withActivePromo));
}

export async function POST(req: NextRequest) {
  try { await requireAuth(req); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  const { productId, name, attributes, costPrice, salePrice, shippingCost, vatRate, barcode, supplierRef, lowStockThreshold } = await req.json();
  if (!productId || !name?.trim()) {
    return NextResponse.json({ error: 'productId et nom requis' }, { status: 400 });
  }
  const variant = await prisma.productVariant.create({
    data: {
      productId,
      name: name.trim(),
      attributes: JSON.stringify(attributes || []),
      costPrice: Number(costPrice) || 0,
      salePrice: Number(salePrice) || 0,
      shippingCost: Number(shippingCost) || 0,
      vatRate: Number(vatRate ?? 20),
      barcode: barcode?.trim() || null,
      supplierRef: supplierRef?.trim() || null,
      lowStockThreshold: lowStockThreshold !== undefined && lowStockThreshold !== '' ? Number(lowStockThreshold) : null,
    },
  });
  return NextResponse.json(variant, { status: 201 });
}
