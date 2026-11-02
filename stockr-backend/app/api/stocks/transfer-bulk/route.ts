import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// POST /api/stocks/transfer-bulk
// { fromLocationId, toLocationId, items: [{ variantId, quantity }], notes? }
// Tout ou rien : une seule transaction, refus si un stock source est insuffisant.
export async function POST(req: NextRequest) {
  let userId: string;
  try { userId = await requireAuth(req); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const body = await req.json().catch(() => null) as {
    fromLocationId?: string; toLocationId?: string; notes?: string;
    items?: { variantId?: string; quantity?: number }[];
  } | null;
  const { fromLocationId, toLocationId } = body ?? {};
  if (!fromLocationId || !toLocationId) return NextResponse.json({ error: 'Zones de départ et d’arrivée requises' }, { status: 400 });
  if (fromLocationId === toLocationId) return NextResponse.json({ error: 'Source et destination identiques' }, { status: 400 });

  // Fusionne les doublons et ignore les quantités nulles
  const merged = new Map<string, number>();
  for (const it of body?.items ?? []) {
    const qty = Math.floor(Number(it.quantity));
    if (!it.variantId || !Number.isFinite(qty) || qty <= 0) continue;
    merged.set(it.variantId, (merged.get(it.variantId) ?? 0) + qty);
  }
  if (merged.size === 0) return NextResponse.json({ error: 'Aucune quantité à déplacer' }, { status: 400 });

  const sources = await prisma.stock.findMany({
    where: { locationId: fromLocationId, variantId: { in: [...merged.keys()] } },
    include: { variant: { select: { name: true } } },
  });
  const byVariant = new Map(sources.map(s => [s.variantId, s]));
  for (const [variantId, qty] of merged) {
    const src = byVariant.get(variantId);
    if (!src || src.quantity < qty) {
      return NextResponse.json({ error: `Stock insuffisant pour ${src?.variant.name ?? variantId} (disponible : ${src?.quantity ?? 0})` }, { status: 400 });
    }
  }

  const notes = body?.notes?.trim() || null;
  try {
  await prisma.$transaction(async tx => {
    for (const [variantId, qty] of merged) {
      // Re-vérifie dans la transaction : un autre mouvement a pu passer entre-temps
      const res = await tx.stock.updateMany({
        where: { variantId, locationId: fromLocationId, quantity: { gte: qty } },
        data: { quantity: { decrement: qty } },
      });
      if (res.count === 0) throw new Error(`Stock insuffisant pour ${byVariant.get(variantId)?.variant.name ?? variantId}`);
      await tx.stock.upsert({
        where: { variantId_locationId: { variantId, locationId: toLocationId } },
        update: { quantity: { increment: qty } },
        create: { variantId, locationId: toLocationId, quantity: qty },
      });
      const t = await tx.stockTransfer.create({ data: { variantId, fromLocationId, toLocationId, quantity: qty, notes } });
      await tx.stockMovement.create({ data: { variantId, locationId: fromLocationId, type: 'transfer_out', delta: -qty, userId, ref: t.id, notes } });
      await tx.stockMovement.create({ data: { variantId, locationId: toLocationId, type: 'transfer_in', delta: qty, userId, ref: t.id, notes } });
    }
  });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status: 400 });
  }

  return NextResponse.json({ ok: true, moved: merged.size, units: [...merged.values()].reduce((a, b) => a + b, 0) });
}
