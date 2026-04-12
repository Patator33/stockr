import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// POST /api/stocks/adjust
// mode "add" (default) : increments by quantity (negative = remove)
// mode "set"           : sets quantity to an absolute value
export async function POST(req: NextRequest) {
  try { await requireAuth(req); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  const { variantId, locationId, quantity, mode } = await req.json();
  if (!variantId || !locationId || quantity === undefined) {
    return NextResponse.json({ error: 'variantId, locationId et quantity requis' }, { status: 400 });
  }
  const qty = Number(quantity);

  if (mode === 'set') {
    const stock = await prisma.stock.upsert({
      where: { variantId_locationId: { variantId, locationId } },
      update: { quantity: qty },
      create: { variantId, locationId, quantity: qty },
    });
    return NextResponse.json(stock);
  }

  // Default: add (increment, qty may be negative for removal)
  const stock = await prisma.stock.upsert({
    where: { variantId_locationId: { variantId, locationId } },
    update: { quantity: { increment: qty } },
    create: { variantId, locationId, quantity: qty },
  });
  return NextResponse.json(stock);
}
