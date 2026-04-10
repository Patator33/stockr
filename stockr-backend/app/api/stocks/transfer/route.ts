import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// POST /api/stocks/transfer
export async function POST(req: NextRequest) {
  try { await requireAuth(req); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
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

  await prisma.$transaction([
    // Deduct from source
    prisma.stock.update({
      where: { variantId_locationId: { variantId, locationId: fromLocationId } },
      data: { quantity: { decrement: qty } },
    }),
    // Add to destination
    prisma.stock.upsert({
      where: { variantId_locationId: { variantId, locationId: toLocationId } },
      update: { quantity: { increment: qty } },
      create: { variantId, locationId: toLocationId, quantity: qty },
    }),
    // Record transfer
    prisma.stockTransfer.create({
      data: { variantId, fromLocationId, toLocationId, quantity: qty, notes: notes?.trim() || null },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
