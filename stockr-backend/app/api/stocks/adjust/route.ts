import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// POST /api/stocks/adjust — set quantity directly
export async function POST(req: NextRequest) {
  try { await requireAuth(req); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  const { variantId, locationId, quantity } = await req.json();
  if (!variantId || !locationId || quantity === undefined) {
    return NextResponse.json({ error: 'variantId, locationId et quantity requis' }, { status: 400 });
  }
  const qty = Math.max(0, Number(quantity));
  const stock = await prisma.stock.upsert({
    where: { variantId_locationId: { variantId, locationId } },
    update: { quantity: qty },
    create: { variantId, locationId, quantity: qty },
  });
  return NextResponse.json(stock);
}
