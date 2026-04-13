import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// POST /api/stocks/transfer
export async function POST(req: NextRequest) {
  let userId: string;
  try { userId = await requireAuth(req); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  const { variantId, fromLocationId, toLocationId, quantity, notes } = await req.json();
  if (!variantId || !fromLocationId || !toLocationId || !quantity) {
    return NextResponse.json({ error: 'Tous les champs requis' }, { status: 400 });
  }
  if (fromLocationId === toLocationId) {
    return NextResponse.json({ error: 'Source et destination identiques' }, { status: 400 });
  }
  const qty = Number(quantity);
  if (qty <= 0) return NextResponse.json({ error: 'Quantité invalide' }, { status: 400 });

  // Check source stock
  const sourceStock = await prisma.stock.findUnique({
    where: { variantId_locationId: { variantId, locationId: fromLocationId } },
  });
  if (!sourceStock || sourceStock.quantity < qty) {
    return NextResponse.json({ error: 'Stock insuffisant' }, { status: 400 });
  }

  const transfer = await prisma.$transaction(async tx => {
    await tx.stock.update({
      where: { variantId_locationId: { variantId, locationId: fromLocationId } },
      data: { quantity: { decrement: qty } },
    });
    await tx.stock.upsert({
      where: { variantId_locationId: { variantId, locationId: toLocationId } },
      update: { quantity: { increment: qty } },
      create: { variantId, locationId: toLocationId, quantity: qty },
    });
    const t = await tx.stockTransfer.create({
      data: { variantId, fromLocationId, toLocationId, quantity: qty, notes: notes?.trim() || null },
    });
    await tx.stockMovement.create({
      data: { variantId, locationId: fromLocationId, type: 'transfer_out', delta: -qty, userId, ref: t.id, notes: notes || null },
    });
    await tx.stockMovement.create({
      data: { variantId, locationId: toLocationId, type: 'transfer_in', delta: qty, userId, ref: t.id, notes: notes || null },
    });
    return t;
  });

  return NextResponse.json({ ok: true, transferId: transfer.id });
}
