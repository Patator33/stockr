import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try { await requireAuth(req); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  const productId = req.nextUrl.searchParams.get('productId');
  const barcode = req.nextUrl.searchParams.get('barcode');
  const supplierRef = req.nextUrl.searchParams.get('supplierRef');
  const now = new Date();
  const withActivePromo = (v: { promotions: { id: string; price: number; startDate: Date; endDate: Date | null; variantId: string; createdAt: Date }[] }) => {
    const active = v.promotions.find(p => p.startDate <= now && (!p.endDate || p.endDate >= now)) || null;
    return { ...v, activePromotion: active };
  };

  if (barcode || supplierRef) {
    const where = barcode ? { barcode } : { supplierRef: supplierRef! };
    const variant = await prisma.productVariant.findUnique({
      where,
      include: { stocks: { include: { location: true } }, product: true, promotions: true },
    });
    if (!variant) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(withActivePromo(variant));
  }
  const where = productId ? { productId } : {};
  const variants = await prisma.productVariant.findMany({
    where,
    include: { stocks: { include: { location: true } }, promotions: true },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json(variants.map(withActivePromo));
}

export async function POST(req: NextRequest) {
  try { await requireAuth(req); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  const { productId, name, attributes, costPrice, salePrice, shippingCost, vatRate, barcode, supplierRef } = await req.json();
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
    },
  });
  return NextResponse.json(variant, { status: 201 });
}
