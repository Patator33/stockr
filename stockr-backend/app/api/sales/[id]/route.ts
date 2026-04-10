import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAuth(req); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  const { id } = await params;
  const sale = await prisma.sale.findUnique({
    where: { id },
    include: {
      variant: { include: { product: { select: { id: true, name: true } } } },
      location: true,
      returns: true,
    },
  });
  if (!sale) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(sale);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAuth(req); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  const { id } = await params;
  const sale = await prisma.sale.findUnique({ where: { id } });
  if (!sale) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  // Restore stock
  await prisma.$transaction([
    prisma.stock.upsert({
      where: { variantId_locationId: { variantId: sale.variantId, locationId: sale.locationId } },
      update: { quantity: { increment: sale.quantity } },
      create: { variantId: sale.variantId, locationId: sale.locationId, quantity: sale.quantity },
    }),
    prisma.sale.delete({ where: { id } }),
  ]);
  return NextResponse.json({ ok: true });
}
