import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try { await requireAuth(req); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  const { searchParams } = req.nextUrl;
  const from = searchParams.get('from');
  const to   = searchParams.get('to');

  const where: Record<string, unknown> = {};
  if (from || to) {
    where.createdAt = {};
    if (from) (where.createdAt as Record<string, Date>).gte = new Date(from);
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      (where.createdAt as Record<string, Date>).lte = toDate;
    }
  }

  const sales = await prisma.sale.findMany({
    where,
    include: {
      variant:  { include: { product: { select: { name: true } } } },
      location: { select: { name: true } },
      returns:  true,
      order:    { select: { id: true, customerName: true, customerEmail: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const rows: string[] = [
    'Date,Produit,Variante,Zone,Qté,Retours,Qté nette,Prix vente,CA HT estimé,TVA %,TVA,CA TTC,Prix achat,Frais port,Marge,Commande,Notes',
  ];

  for (const s of sales) {
    const returned  = s.returns.reduce((sum, r) => sum + r.quantity, 0);
    const net       = s.quantity - returned;
    const vatRate   = s.vatRate ?? 20;
    const revenue   = net * s.unitSalePrice;
    const vat       = revenue * vatRate / (100 + vatRate);
    const revenueHT = revenue - vat;
    const margin    = revenue - net * s.unitCostPrice - net * s.unitShippingCost;
    const orderRef  = s.order ? (s.order.customerName || s.order.customerEmail || s.order.id.slice(0, 8)) : '';
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    rows.push([
      new Date(s.createdAt).toLocaleDateString('fr-FR'),
      esc(s.variant?.product?.name ?? ''),
      esc(s.variant?.name ?? s.variantId.slice(0, 8)),
      esc(s.location?.name ?? ''),
      s.quantity,
      returned,
      net,
      s.unitSalePrice.toFixed(2),
      revenueHT.toFixed(2),
      vatRate,
      vat.toFixed(2),
      revenue.toFixed(2),
      s.unitCostPrice.toFixed(2),
      s.unitShippingCost.toFixed(2),
      margin.toFixed(2),
      esc(orderRef),
      esc(s.notes ?? ''),
    ].join(','));
  }

  const csv  = rows.join('\n');
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="ventes_${date}.csv"`,
    },
  });
}
