import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { requireApiKey } from '@/lib/apiKey';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try { await requireAuth(req); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  const status = req.nextUrl.searchParams.get('status');
  const orders = await prisma.order.findMany({
    where: status ? { status } : {},
    include: {
      items: {
        include: { variant: { include: { product: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(orders);
}

export async function POST(req: NextRequest) {
  // Accept both API key (n8n) and session auth (mobile)
  const apiKeyOk = requireApiKey(req);
  if (!apiKeyOk) {
    try { await requireAuth(req); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  }

  const body = await req.json();
  const { customerName, customerEmail, notes, source, items } = body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'items requis' }, { status: 400 });
  }

  // Resolve variants by barcode or name
  const resolvedItems = await Promise.all(
    items.map(async (item: { barcode?: string; supplierRef?: string; variantName?: string; quantity: number }) => {
      let variantId: string | null = null;
      let resolvedName = item.variantName || item.supplierRef || item.barcode || 'Article';
      // Resolve by supplierRef first, then barcode
      if (item.supplierRef) {
        const v = await prisma.productVariant.findUnique({ where: { supplierRef: item.supplierRef }, include: { product: true } });
        if (v) { variantId = v.id; resolvedName = item.variantName || v.name; }
      }
      if (!variantId && item.barcode) {
        const v = await prisma.productVariant.findUnique({ where: { barcode: item.barcode }, include: { product: true } });
        if (v) { variantId = v.id; resolvedName = item.variantName || v.name; }
      }
      return {
        barcode: item.barcode || null,
        variantName: resolvedName,
        quantity: Number(item.quantity) || 1,
        variantId,
      };
    })
  );

  const order = await prisma.order.create({
    data: {
      customerName: customerName || null,
      customerEmail: customerEmail || null,
      notes: notes || null,
      source: source || 'n8n',
      items: { create: resolvedItems },
    },
    include: {
      items: { include: { variant: { include: { product: true } } } },
    },
  });

  return NextResponse.json(order, { status: 201 });
}
