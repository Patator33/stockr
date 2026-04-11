import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAuth(req); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  const { id } = await params;
  const { name, attributes, costPrice, salePrice, shippingCost, barcode, supplierRef } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Nom requis' }, { status: 400 });
  const variant = await prisma.productVariant.update({
    where: { id },
    data: {
      name: name.trim(),
      attributes: JSON.stringify(attributes || []),
      costPrice: Number(costPrice) || 0,
      salePrice: Number(salePrice) || 0,
      shippingCost: Number(shippingCost) || 0,
      barcode: barcode?.trim() || null,
      supplierRef: supplierRef?.trim() || null,
    },
  });
  return NextResponse.json(variant);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAuth(req); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  const { id } = await params;
  await prisma.productVariant.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
