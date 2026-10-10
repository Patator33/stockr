import { prisma } from './prisma';

/**
 * Annule l'expédition d'une commande : supprime les ventes créées à l'expédition
 * (donc stats et dashboard) et remet en stock la quantité nette, c'est-à-dire
 * hors retours déjà réintégrés. Retourne le nombre de ventes annulées.
 */
export async function reverseOrderShipment(orderId: string, userId: string): Promise<number> {
  const sales = await prisma.sale.findMany({ where: { orderId }, include: { returns: true } });
  if (sales.length === 0) return 0;

  await prisma.$transaction(async tx => {
    for (const sale of sales) {
      const returned = sale.returns.reduce((s, r) => s + r.quantity, 0);
      const net = sale.quantity - returned;
      if (net > 0) {
        await tx.stock.upsert({
          where: { variantId_locationId: { variantId: sale.variantId, locationId: sale.locationId } },
          update: { quantity: { increment: net } },
          create: { variantId: sale.variantId, locationId: sale.locationId, quantity: net },
        });
        await tx.stockMovement.create({
          data: {
            variantId: sale.variantId, locationId: sale.locationId, type: 'sale_cancel', delta: net,
            userId, ref: sale.id, notes: `Annulation expédition ${orderId.slice(0, 8)}`,
          },
        });
      }
      await tx.sale.delete({ where: { id: sale.id } }); // retours supprimés en cascade
    }
  });
  return sales.length;
}
