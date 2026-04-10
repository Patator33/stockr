import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try { await requireAuth(req); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  const { saleId, quantity, reason, notes } = await req.json();
  if (!saleId || !quantity) return NextResponse.json({ error: 'saleId et quantity requis' }, { status: 400 });

  const sale = await prisma.sale.findUnique({ where: { id: saleId }, include: { returns: true } });
  if (!sale) return NextResponse.json({ error: 'Vente introuvable' }, { status: 404 });

  const alreadyReturned = sale.returns.reduce((sum, r) => sum + r.quantity, 0);
  const qty = Number(quantity);
  if (qty <= 0 || qty + alreadyReturned > sale.quantity) {
    return NextResponse.json({ error: 'Quantité de retour invalide' }, { status: 400 });
  }

  const [ret] = await prisma.$transaction([
    prisma.return.create({
      data: { saleId, quantity: qty, reason: reason?.trim() || null, notes: notes?.trim() || null },
    }),
    // Restore stock
    prisma.stock.upsert({
      where: { variantId_locationId: { variantId: sale.variantId, locationId: sale.locationId } },
      update: { quantity: { increment: qty } },
      create: { variantId: sale.variantId, locationId: sale.locationId, quantity: qty },
    }),
  ]);

  return NextResponse.json(ret, { status: 201 });
}
