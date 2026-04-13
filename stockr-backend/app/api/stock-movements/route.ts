import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try { await requireAuth(req); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  const { searchParams } = req.nextUrl;
  const variantId  = searchParams.get('variantId');
  const locationId = searchParams.get('locationId');
  const type       = searchParams.get('type');
  const page       = Number(searchParams.get('page') || '1');
  const limit      = 100;

  const where: Record<string, unknown> = {};
  if (variantId)  where.variantId  = variantId;
  if (locationId) where.locationId = locationId;
  if (type)       where.type       = type;

  const [movements, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      include: {
        variant:  { include: { product: { select: { name: true } } } },
        location: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip:  (page - 1) * limit,
      take:  limit,
    }),
    prisma.stockMovement.count({ where }),
  ]);

  return NextResponse.json({ movements, total, page, pages: Math.ceil(total / limit) });
}
