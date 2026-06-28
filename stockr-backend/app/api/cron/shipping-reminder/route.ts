import { NextRequest, NextResponse } from 'next/server';
import { requireApiKey } from '@/lib/apiKey';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  if (!requireApiKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const setting = await prisma.setting.findUnique({ where: { key: 'shippingReminderWebhookUrl' } });
  if (!setting?.value) {
    return NextResponse.json({ skipped: true, reason: 'No shippingReminderWebhookUrl configured' });
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const orders = await prisma.order.findMany({
    where: {
      shippingDate: { gte: todayStart, lte: todayEnd },
      status: { not: 'shipped' },
    },
    include: { items: true },
  });

  if (orders.length === 0) {
    return NextResponse.json({ triggered: 0 });
  }

  const results = await Promise.allSettled(
    orders.map(order =>
      fetch(setting.value, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'shipping_reminder', order }),
      })
    )
  );

  const succeeded = results.filter(r => r.status === 'fulfilled').length;
  const failed    = results.filter(r => r.status === 'rejected').length;

  return NextResponse.json({ triggered: orders.length, succeeded, failed });
}
