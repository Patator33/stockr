import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logAction } from '@/lib/audit';

async function auth(req: NextRequest): Promise<{ ok: false } | { ok: true; userId: string; userEmail: string }> {
  try {
    const userId = await requireAuth(req);
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    return { ok: true, userId, userEmail: user?.email ?? '' };
  } catch { return { ok: false }; }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth(req);
  if (!session.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: { include: { variant: { include: { product: true } } } } },
  });
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(order);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth(req);
  if (!session.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  // Update locationId only
  if (body.locationId !== undefined && body.status === undefined && body.itemId === undefined) {
    const order = await prisma.order.update({
      where: { id },
      data: { locationId: body.locationId || null },
      include: { items: { include: { variant: { include: { product: true } } } } },
    });
    return NextResponse.json(order);
  }

  // Update order status and/or shippingDate
  if (body.status !== undefined || body.shippingDate !== undefined) {
    const data: Record<string, unknown> = {};
    if (body.status !== undefined) data.status = body.status;
    if (body.shippingDate !== undefined) data.shippingDate = body.shippingDate ? new Date(body.shippingDate) : null;

    // Destock + create Sales on ship
    if (body.status === 'shipped') {
      const order = await prisma.order.findUnique({
        where: { id },
        include: { items: { include: { variant: { include: { promotions: true } } } } },
      });
      if (order?.locationId) {
        const locationId = order.locationId;
        const now = new Date();
        for (const item of order.items) {
          if (!item.variantId || !item.variant) continue;
          const variant = item.variant;
          const activePromo = variant.promotions.find(p => {
            const start = new Date(p.startDate); start.setUTCHours(0, 0, 0, 0);
            const end = p.endDate ? new Date(p.endDate) : null; if (end) end.setUTCHours(23, 59, 59, 999);
            return start <= now && (!end || end >= now);
          }) || null;
          const effectiveSalePrice = activePromo ? activePromo.price : variant.salePrice;
          await prisma.stock.upsert({
            where: { variantId_locationId: { variantId: item.variantId, locationId } },
            update: { quantity: { decrement: item.quantity } },
            create: { variantId: item.variantId, locationId, quantity: -item.quantity },
          });
          const sale = await prisma.sale.create({
            data: {
              variantId: item.variantId,
              locationId,
              orderId: order.id,
              quantity: item.quantity,
              unitSalePrice: effectiveSalePrice,
              unitCostPrice: variant.costPrice,
              unitShippingCost: variant.shippingCost,
              vatRate: variant.vatRate,
              notes: `Commande ${order.customerName || order.customerEmail || order.id.slice(0, 8)}`,
            },
          });
          // Log stock movement
          await prisma.stockMovement.create({
            data: { variantId: item.variantId, locationId, type: 'sale', delta: -item.quantity, userId: session.userId, ref: sale.id, notes: `Commande ${order.id.slice(0, 8)}` },
          });
        }
      }
    }

    const order = await prisma.order.update({
      where: { id },
      data,
      include: { items: { include: { variant: { include: { product: true } } } } },
    });
    if (body.status) {
      await logAction(session.userId, session.userEmail, `order.${body.status}`, `Commande ${id.slice(0, 8)}`);
    }
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
  const session = await auth(req);
  if (!session.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  await prisma.order.delete({ where: { id } });
  await logAction(session.userId, session.userEmail, 'order.delete', `Commande ${id.slice(0, 8)}`);
  return NextResponse.json({ ok: true });
}
