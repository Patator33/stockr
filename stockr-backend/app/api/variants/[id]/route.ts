import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAuth(req); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  const { id } = await params;
  const { name, attributes, costPrice, salePrice, shippingCost, vatRate, barcode, supplierRef } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Nom requis' }, { status: 400 });
  const variant = await prisma.productVariant.update({
    where: { id },
    data: {
      name: name.trim(),
      attributes: JSON.stringify(attributes || []),
      costPrice: Number(costPrice) || 0,
      salePrice: Number(salePrice) || 0,
      shippingCost: Number(shippingCost) || 0,
      vatRate: vatRate !== undefined ? Number(vatRate) : undefined,
      barcode: barcode?.trim() || null,
      supplierRef: supplierRef?.trim() || null,
    },
  });
  return NextResponse.json(variant);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAuth(req); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  const { id } = await params;
  try {
    const salesCount = await prisma.sale.count({ where: { variantId: id } });
    if (salesCount > 0) {
      return NextResponse.json(
        { error: `Impossible de supprimer : ${salesCount} vente(s) associée(s). Supprimez d'abord les ventes.` },
        { status: 409 }
      );
    }
    const transfersCount = await prisma.stockTransfer.count({ where: { variantId: id } });
    if (transfersCount > 0) {
      return NextResponse.json(
        { error: `Impossible de supprimer : ${transfersCount} transfert(s) associé(s).` },
        { status: 409 }
      );
    }
    // Détacher les commandes (variantId nullable)
    await prisma.orderItem.updateMany({ where: { variantId: id }, data: { variantId: null } });
    await prisma.productVariant.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[variants DELETE] error:', e);
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
