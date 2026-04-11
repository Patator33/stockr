import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAuth(req); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  const { id } = await params;
  const { name, description } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Nom requis' }, { status: 400 });
  const location = await prisma.storageLocation.update({
    where: { id },
    data: { name: name.trim(), description: description?.trim() || null },
  });
  return NextResponse.json(location);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAuth(req); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  const { id } = await params;
  const { isDefault } = await req.json();
  if (isDefault) {
    // Unset all, then set this one
    await prisma.storageLocation.updateMany({ data: { isDefault: false } });
  }
  const location = await prisma.storageLocation.update({
    where: { id },
    data: { isDefault: Boolean(isDefault) },
  });
  return NextResponse.json(location);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAuth(req); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  const { id } = await params;
  await prisma.storageLocation.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
