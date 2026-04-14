import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/supplier-prices?variantId=xxx  → all supplier prices for a variant
// GET /api/supplier-prices?supplierId=xxx → all variant prices for a supplier
export async function GET(req: NextRequest) {
  try { await requireAuth(req); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  const variantId  = req.nextUrl.searchParams.get('variantId');
  const supplierId = req.nextUrl.searchParams.get('supplierId');
  const where: Record<string, string> = {};
  if (variantId)  where.variantId  = variantId;
  if (supplierId) where.supplierId = supplierId;
  const prices = await prisma.variantSupplierPrice.findMany({
    where,
    include: {
      supplier: true,
      variant:  { include: { product: { select: { id: true, name: true } } } },
    },
    orderBy: { supplier: { name: 'asc' } },
  });
  return NextResponse.json(prices);
}

// POST /api/supplier-prices — upsert price for a (variantId, supplierId) pair
export async function POST(req: NextRequest) {
  try { await requireAuth(req); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  const { variantId, supplierId, salePrice, costPrice, shippingCost, vatRate } = await req.json();
  if (!variantId || !supplierId || salePrice === undefined) {
    return NextResponse.json({ error: 'variantId, supplierId et salePrice requis' }, { status: 400 });
  }
  const price = await prisma.variantSupplierPrice.upsert({
    where: { variantId_supplierId: { variantId, supplierId } },
    update: {
      salePrice:    Number(salePrice),
      costPrice:    costPrice    !== undefined ? Number(costPrice)    : undefined,
      shippingCost: shippingCost !== undefined ? Number(shippingCost) : undefined,
      vatRate:      vatRate      !== undefined ? Number(vatRate)      : undefined,
    },
    create: {
      variantId,
      supplierId,
      salePrice:    Number(salePrice),
      costPrice:    Number(costPrice    ?? 0),
      shippingCost: Number(shippingCost ?? 0),
      vatRate:      Number(vatRate      ?? 20),
    },
    include: { supplier: true },
  });
  return NextResponse.json(price, { status: 201 });
}
