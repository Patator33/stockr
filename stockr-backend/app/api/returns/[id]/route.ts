import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAuth(req); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  const { id } = await params;
  const ret = await prisma.return.findUnique({ where: { id }, include: { sale: true } });
  if (!ret) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  // Deduct stock back (cancel the return)
  await prisma.$transaction([
    prisma.stock.upsert({
      where: { variantId_locationId: { variantId: ret.sale.variantId, locationId: ret.sale.locationId } },
      update: { quantity: { decrement: ret.quantity } },
      create: { variantId: ret.sale.variantId, locationId: ret.sale.locationId, quantity: 0 },
    }),
    prisma.return.delete({ where: { id } }),
  ]);
  return NextResponse.json({ ok: true });
}
