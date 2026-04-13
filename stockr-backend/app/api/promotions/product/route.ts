import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// POST /api/promotions/product
// Creates a promotion for every variant of a product
export async function POST(req: NextRequest) {
  try { await requireAuth(req); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  const { productId, price, startDate, endDate } = await req.json();
  if (!productId || price === undefined || !startDate) {
    return NextResponse.json({ error: 'productId, price et startDate requis' }, { status: 400 });
  }
  const variants = await prisma.productVariant.findMany({ where: { productId } });
  if (variants.length === 0) {
    return NextResponse.json({ error: 'Aucune variante pour ce produit' }, { status: 404 });
  }
  const promos = await prisma.$transaction(
    variants.map(v =>
      prisma.promotion.create({
        data: {
          variantId: v.id,
          price:     Number(price),
          startDate: new Date(startDate),
          endDate:   endDate ? new Date(endDate) : null,
        },
      })
    )
  );
  return NextResponse.json({ created: promos.length }, { status: 201 });
}
