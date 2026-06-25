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

  let body: unknown;
  try {
    body = await req.json();
  } catch (e) {
    console.error('[orders POST] Invalid JSON body:', e);
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  console.log('[orders POST] body:', JSON.stringify(body));

  const { customerName, customerEmail, notes, source, shippingDate, items } = body as {
    customerName?: string; customerEmail?: string; notes?: string; source?: string;
    shippingDate?: string;
    items?: { barcode?: string; supplierRef?: string; variantName?: string; quantity: number }[];
  };

  if (!items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'items requis' }, { status: 400 });
  }

  try {
    // Resolve variants by supplierRef or barcode
    const resolvedItems = await Promise.all(
      items.map(async (item) => {
        let variantId: string | null = null;
        let resolvedName = item.variantName || item.supplierRef || item.barcode || 'Article';
        if (item.supplierRef) {
          console.log('[orders POST] resolving by supplierRef:', item.supplierRef);
          // 1. Try generic variant-level supplierRef
          const v = await prisma.productVariant.findUnique({ where: { supplierRef: item.supplierRef }, include: { product: true } });
          if (v) { variantId = v.id; resolvedName = v.name; }
          else {
            // 2. Try per-supplier VariantSupplierPrice.supplierRef
            const sp = await prisma.variantSupplierPrice.findFirst({
              where: { supplierRef: item.supplierRef },
              include: { variant: true },
            });
            if (sp) { variantId = sp.variantId; resolvedName = sp.variant.name; }
            else console.warn('[orders POST] no variant found for supplierRef:', item.supplierRef);
          }
        }
        if (!variantId && item.barcode) {
          console.log('[orders POST] resolving by barcode:', item.barcode);
          const v = await prisma.productVariant.findUnique({ where: { barcode: item.barcode }, include: { product: true } });
          if (v) { variantId = v.id; resolvedName = item.variantName || v.name; }
          else console.warn('[orders POST] no variant found for barcode:', item.barcode);
        }
        return {
          barcode: item.barcode || null,
          variantName: resolvedName,
          quantity: Number(item.quantity) || 1,
          variantId,
        };
      })
    );

    console.log('[orders POST] resolvedItems:', JSON.stringify(resolvedItems));

    const order = await prisma.order.create({
      data: {
        customerName: customerName || null,
        customerEmail: customerEmail || null,
        notes: notes || null,
        source: source || 'n8n',
        shippingDate: shippingDate ? new Date(shippingDate) : null,
        items: { create: resolvedItems },
      },
      include: {
        items: { include: { variant: { include: { product: true } } } },
      },
    });

    console.log('[orders POST] created order:', order.id);

    // Fire webhook if configured (fire-and-forget)
    prisma.setting.findUnique({ where: { key: 'webhookUrl' } }).then(setting => {
      if (setting?.value) {
        fetch(setting.value, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(order),
        }).catch(e => console.error('[orders POST] webhook error:', e));
      }
    }).catch(e => console.error('[orders POST] webhook setting error:', e));

    return NextResponse.json(order, { status: 201 });
  } catch (e) {
    console.error('[orders POST] error:', e);
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
