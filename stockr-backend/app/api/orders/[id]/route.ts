import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

async function auth(req: NextRequest) {
  try { await requireAuth(req); } catch { return false; }
  return true;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: { include: { variant: { include: { product: true } } } } },
  });
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(order);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  // Update order status
  if (body.status !== undefined) {
    const order = await prisma.order.update({
      where: { id },
      data: { status: body.status },
      include: { items: { include: { variant: { include: { product: true } } } } },
    });
    return NextResponse.json(order);
  }

  // Update item scanned count
  if (body.itemId !== undefined && body.scanned !== undefined) {
    const item = await prisma.orderItem.update({
      where: { id: body.itemId },
      data: { scanned: Number(body.scanned) },
    });
    return NextResponse.json(item);
  }

  return NextResponse.json({ error: 'Rien à mettre à jour' }, { status: 400 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  await prisma.order.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
