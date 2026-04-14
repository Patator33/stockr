import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try { await requireAuth(req); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  const { searchParams } = req.nextUrl;
  const productId  = searchParams.get('productId');
  const supplierId = searchParams.get('supplierId');
  const period = searchParams.get('period') || '30'; // days

  const days = Number(period);
  const from = new Date();
  from.setDate(from.getDate() - days);

  const saleWhere: Record<string, unknown> = { createdAt: { gte: from } };
  if (productId)  saleWhere.variant    = { productId };
  if (supplierId) saleWhere.supplierId = supplierId;

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
  let totalVat = 0;
  const variantStats: Record<string, { name: string; productName: string; sold: number; returned: number; revenue: number; margin: number }> = {};
  const dailyMap: Record<string, number> = {};

  for (const sale of sales) {
    const returnedQty = sale.returns.reduce((sum, r) => sum + r.quantity, 0);
    const effectiveQty = sale.quantity - returnedQty;
    const revenue = effectiveQty * sale.unitSalePrice;
    const cost = effectiveQty * sale.unitCostPrice;
    const shipping = effectiveQty * sale.unitShippingCost;
    const netMargin = revenue - cost - shipping;
    const vatRate = (sale as { vatRate?: number }).vatRate ?? 20;
    const vat = revenue * vatRate / (100 + vatRate);

    totalRevenue += revenue;
    totalCost += cost;
    totalShipping += shipping;
    totalReturnedQty += returnedQty;
    totalSoldQty += sale.quantity;
    totalVat += vat;

    // Daily aggregation
    const dateKey = new Date(sale.createdAt).toISOString().slice(0, 10);
    dailyMap[dateKey] = (dailyMap[dateKey] || 0) + revenue;

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

  // Build daily revenue array (fill missing days with 0)
  const dailyRevenue: { date: string; revenue: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    dailyRevenue.push({ date: key, revenue: Math.round((dailyMap[key] || 0) * 100) / 100 });
  }

  // Stock total
  const stockWhere = productId ? { variant: { productId } } : {};
  const stockAgg = await prisma.stock.aggregate({ where: stockWhere, _sum: { quantity: true } });
  const totalStock = stockAgg._sum.quantity || 0;

  // Low stock alerts
  const lowStockVariants = await prisma.productVariant.findMany({
    where: {
      lowStockThreshold: { not: null },
      stocks: { some: {} },
    },
    include: {
      stocks: { include: { location: { select: { name: true } } } },
      product: { select: { name: true } },
    },
  });
  const lowStockAlerts = lowStockVariants
    .map(v => {
      const totalQty = v.stocks.reduce((s, st) => s + st.quantity, 0);
      return { variantId: v.id, variantName: v.name, productName: v.product.name, totalQty, threshold: v.lowStockThreshold! };
    })
    .filter(a => a.totalQty <= a.threshold);

  // Overdue orders (pending > 7 days)
  const overdueFrom = new Date();
  overdueFrom.setDate(overdueFrom.getDate() - 7);
  const overdueOrders = await prisma.order.count({
    where: { status: 'pending', createdAt: { lt: overdueFrom } },
  });

  console.log(`[stats] productId=${productId} period=${days}d from=${from.toISOString()} salesFound=${sales.length} totalSoldQty=${totalSoldQty} totalRevenue=${totalRevenue}`);

  return NextResponse.json({
    period: days,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100,
    totalShipping: Math.round(totalShipping * 100) / 100,
    grossMargin: Math.round(grossMargin * 100) / 100,
    netMargin: Math.round(netMargin * 100) / 100,
    totalVat: Math.round(totalVat * 100) / 100,
    totalSoldQty,
    totalReturnedQty,
    totalStock,
    topVariants,
    dailyRevenue,
    lowStockAlerts,
    overdueOrders,
    _debug: { salesFound: sales.length, from: from.toISOString() },
  });
}
