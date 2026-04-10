import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try { await requireAuth(req); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  const productId = req.nextUrl.searchParams.get('productId');
  const where = productId ? { productId } : {};
  const variants = await prisma.productVariant.findMany({
    where,
    include: { stocks: { include: { location: true } } },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json(variants);
}

export async function POST(req: NextRequest) {
  try { await requireAuth(req); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  const { productId, name, attributes, costPrice, salePrice, shippingCost } = await req.json();
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
    },
  });
  return NextResponse.json(variant, { status: 201 });
}
