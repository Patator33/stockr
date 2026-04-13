import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try { await requireAuth(req); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  const variantId = req.nextUrl.searchParams.get('variantId');
  const where = variantId ? { variantId } : {};
  const promotions = await prisma.promotion.findMany({ where, orderBy: { startDate: 'desc' } });
  return NextResponse.json(promotions);
}

export async function POST(req: NextRequest) {
  try { await requireAuth(req); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  const { variantId, price, startDate, endDate } = await req.json();
  if (!variantId || price === undefined || !startDate) {
    return NextResponse.json({ error: 'variantId, price et startDate requis' }, { status: 400 });
  }
  const promo = await prisma.promotion.create({
    data: {
      variantId,
      price: Number(price),
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
    },
  });
  return NextResponse.json(promo, { status: 201 });
}
