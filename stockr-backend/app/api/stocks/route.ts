import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/stocks?productId=xxx → stocks by location for a product
export async function GET(req: NextRequest) {
  try { await requireAuth(req); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  const productId = req.nextUrl.searchParams.get('productId');

  const locations = await prisma.storageLocation.findMany({ orderBy: { name: 'asc' } });

  const variantWhere = productId ? { productId } : {};
  const stocks = await prisma.stock.findMany({
    where: { variant: variantWhere },
    include: {
      variant: { include: { product: { select: { id: true, name: true } } } },
      location: true,
    },
  });

  // Group by location
  const byLocation = locations.map(loc => ({
    location: loc,
    items: stocks
      .filter(s => s.locationId === loc.id)
      .map(s => ({
        variantId: s.variantId,
        variantName: s.variant.name,
        productId: s.variant.productId,
        productName: s.variant.product.name,
        quantity: s.quantity,
        attributes: JSON.parse(s.variant.attributes || '[]'),
        costPrice: s.variant.costPrice,
        salePrice: s.variant.salePrice,
        shippingCost: s.variant.shippingCost,
      })),
  }));

  return NextResponse.json(byLocation);
}
