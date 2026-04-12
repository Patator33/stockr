import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try { await requireAuth(req); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  const { searchParams } = req.nextUrl;
  const productId = searchParams.get('productId');
  const period = searchParams.get('period') || '30'; // days

  const days = Number(period);
  const from = new Date();
  from.setDate(from.getDate() - days);

  const saleWhere: Record<string, unknown> = { createdAt: { gte: from } };
  if (productId) saleWhere.variant = { productId };

  const sales = await prisma.sale.findMany({
    where: saleWhere,
    include: {
      returns: true,
      variant: { include: { product: { select: { id: true, name: true } } } },
    },
  });

  let totalRevenue = 0;
  let totalCost = 0;
  let totalShipping = 0;
  let totalReturnedQty = 0;
  let totalSoldQty = 0;
  const variantStats: Record<string, { name: string; productName: string; sold: number; returned: number; revenue: number; margin: number }> = {};

  for (const sale of sales) {
    const returnedQty = sale.returns.reduce((sum, r) => sum + r.quantity, 0);
    const effectiveQty = sale.quantity - returnedQty;
    const revenue = effectiveQty * sale.unitSalePrice;
    const cost = effectiveQty * sale.unitCostPrice;
    const shipping = effectiveQty * sale.unitShippingCost;
    const netMargin = revenue - cost - shipping;

    totalRevenue += revenue;
    totalCost += cost;
    totalShipping += shipping;
    totalReturnedQty += returnedQty;
    totalSoldQty += sale.quantity;

    const vId = sale.variantId;
    if (!variantStats[vId]) {
      variantStats[vId] = {
        name: sale.variant.name,
        productName: sale.variant.product.name,
        sold: 0,
        returned: 0,
        revenue: 0,
        margin: 0,
      };
    }
    variantStats[vId].sold += sale.quantity;
    variantStats[vId].returned += returnedQty;
    variantStats[vId].revenue += revenue;
    variantStats[vId].margin += netMargin;
  }

  const grossMargin = totalRevenue - totalCost;
  const netMargin = totalRevenue - totalCost - totalShipping;

  const topVariants = Object.values(variantStats)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // Stock total
  const stockWhere = productId ? { variant: { productId } } : {};
  const stockAgg = await prisma.stock.aggregate({ where: stockWhere, _sum: { quantity: true } });
  const totalStock = stockAgg._sum.quantity || 0;

  console.log(`[stats] productId=${productId} period=${days}d from=${from.toISOString()} salesFound=${sales.length} totalSoldQty=${totalSoldQty} totalRevenue=${totalRevenue}`);

  return NextResponse.json({
    period: days,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100,
    totalShipping: Math.round(totalShipping * 100) / 100,
    grossMargin: Math.round(grossMargin * 100) / 100,
    netMargin: Math.round(netMargin * 100) / 100,
    totalSoldQty,
    totalReturnedQty,
    totalStock,
    topVariants,
    _debug: { salesFound: sales.length, from: from.toISOString() },
  });
}
