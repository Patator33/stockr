import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const products = await prisma.product.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { variants: true } } },
  });
  return NextResponse.json(products);
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { name, description } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Nom requis' }, { status: 400 });
  }
  const product = await prisma.product.create({ data: { name: name.trim(), description: description?.trim() || null } });
  return NextResponse.json(product, { status: 201 });
}
