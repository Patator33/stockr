import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// POST /api/stock-returns — bulk return items to default location
export async function POST(req: NextRequest) {
  try { await requireAuth(req); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { items } = await req.json() as {
    items: { variantId: string; quantity: number }[];
  };

  if (!items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'items requis' }, { status: 400 });
  }

  // Find default location
  const defaultLocation = await prisma.storageLocation.findFirst({ where: { isDefault: true } });
  if (!defaultLocation) {
    return NextResponse.json({ error: 'Aucune zone de stockage par défaut définie' }, { status: 400 });
  }

  const locationId = defaultLocation.id;

  await prisma.$transaction(
    items
      .filter(i => i.quantity > 0)
      .map(i =>
        prisma.stock.upsert({
          where: { variantId_locationId: { variantId: i.variantId, locationId } },
          update: { quantity: { increment: i.quantity } },
          create: { variantId: i.variantId, locationId, quantity: i.quantity },
        })
      )
  );

  return NextResponse.json({ ok: true, locationId, count: items.filter(i => i.quantity > 0).length });
}
