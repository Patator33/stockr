import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// POST /api/stock-returns — bulk return items to stock + create Return records on linked Sales
export async function POST(req: NextRequest) {
  try { await requireAuth(req); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { items, locationId: reqLocationId } = await req.json() as {
    items: { variantId: string; quantity: number }[];
    locationId?: string;
  };

  if (!items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'items requis' }, { status: 400 });
  }

  let locationId = reqLocationId;
  if (!locationId) {
    const defaultLocation = await prisma.storageLocation.findFirst({ where: { isDefault: true } });
    if (!defaultLocation) {
      return NextResponse.json({ error: 'Aucune zone de stockage par défaut définie' }, { status: 400 });
    }
    locationId = defaultLocation.id;
  }

  let totalReturned = 0;

  for (const item of items.filter(i => i.quantity > 0)) {
    // Restore stock
    await prisma.stock.upsert({
      where: { variantId_locationId: { variantId: item.variantId, locationId: locationId! } },
      update: { quantity: { increment: item.quantity } },
      create: { variantId: item.variantId, locationId: locationId!, quantity: item.quantity },
    });

    // Attach Return records to most recent sales (FIFO), up to quantity returned
    let remaining = item.quantity;
    const sales = await prisma.sale.findMany({
      where: { variantId: item.variantId },
      include: { returns: true },
      orderBy: { createdAt: 'desc' },
    });

    for (const sale of sales) {
      if (remaining <= 0) break;
      const alreadyReturned = sale.returns.reduce((s, r) => s + r.quantity, 0);
      const returnable = sale.quantity - alreadyReturned;
      if (returnable <= 0) continue;
      const qty = Math.min(remaining, returnable);
      await prisma.return.create({
        data: { saleId: sale.id, quantity: qty, reason: 'Retour stock' },
      });
      remaining -= qty;
    }

    totalReturned++;
  }

  return NextResponse.json({ ok: true, locationId, count: totalReturned });
}
