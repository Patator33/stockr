import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// POST /api/import/stock
// Accepts CSV: barcode,quantity  (header row optional)
// Or JSON array: [{ barcode, quantity, locationId? }]
export async function POST(req: NextRequest) {
  let userId: string;
  try { userId = await requireAuth(req); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const contentType = req.headers.get('content-type') || '';
  let rows: { barcode: string; quantity: number; locationId?: string }[] = [];

  if (contentType.includes('application/json')) {
    rows = await req.json();
  } else {
    // CSV text
    const text = await req.text();
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      const parts = line.split(',').map(p => p.trim().replace(/^"|"$/g, ''));
      const [barcode, quantityStr, locationId] = parts;
      if (!barcode || barcode.toLowerCase() === 'barcode') continue; // skip header
      const quantity = Number(quantityStr);
      if (!barcode || isNaN(quantity)) continue;
      rows.push({ barcode, quantity, locationId: locationId || undefined });
    }
  }

  if (rows.length === 0) return NextResponse.json({ error: 'Aucune ligne valide' }, { status: 400 });

  // Get default location if none specified
  const defaultLocation = await prisma.storageLocation.findFirst({ where: { isDefault: true } });

  const results: { barcode: string; status: string; message?: string }[] = [];

  for (const row of rows) {
    const targetLocationId = row.locationId || defaultLocation?.id;
    if (!targetLocationId) {
      results.push({ barcode: row.barcode, status: 'error', message: 'Aucune zone cible' });
      continue;
    }
    const variant = await prisma.productVariant.findUnique({ where: { barcode: row.barcode } });
    if (!variant) {
      results.push({ barcode: row.barcode, status: 'error', message: 'Code barre inconnu' });
      continue;
    }
    // Get old qty for delta
    const old = await prisma.stock.findUnique({ where: { variantId_locationId: { variantId: variant.id, locationId: targetLocationId } } });
    const oldQty = old?.quantity ?? 0;

    await prisma.stock.upsert({
      where: { variantId_locationId: { variantId: variant.id, locationId: targetLocationId } },
      update: { quantity: { increment: row.quantity } },
      create: { variantId: variant.id, locationId: targetLocationId, quantity: row.quantity },
    });
    await prisma.stockMovement.create({
      data: { variantId: variant.id, locationId: targetLocationId, type: 'import', delta: row.quantity, userId, notes: `Import CSV: ${oldQty} → ${oldQty + row.quantity}` },
    });
    results.push({ barcode: row.barcode, status: 'ok' });
  }

  return NextResponse.json({ results, imported: results.filter(r => r.status === 'ok').length, errors: results.filter(r => r.status === 'error').length });
}
