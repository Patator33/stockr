import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try { await requireAuth(req); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  const variantId  = req.nextUrl.searchParams.get('variantId');
  const supplierId = req.nextUrl.searchParams.get('supplierId');
  const where: Record<string, unknown> = {};
  if (variantId)  where.variantId  = variantId;
  if (supplierId) where.supplierId = supplierId;
  const promotions = await prisma.promotion.findMany({
    where,
    include: { supplier: { select: { id: true, name: true } } },
    orderBy: { startDate: 'desc' },
  });
  return NextResponse.json(promotions);
}

export async function POST(req: NextRequest) {
  try { await requireAuth(req); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  const { variantId, price, startDate, endDate, supplierId } = await req.json();
  if (!variantId || price === undefined || !startDate) {
    return NextResponse.json({ error: 'variantId, price et startDate requis' }, { status: 400 });
  }
  const promo = await prisma.promotion.create({
    data: {
      variantId,
      supplierId: supplierId || null,
      price: Number(price),
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
    },
    include: { supplier: { select: { id: true, name: true } } },
  });
  return NextResponse.json(promo, { status: 201 });
}
