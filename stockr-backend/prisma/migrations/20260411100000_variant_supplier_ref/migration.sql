-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN "supplierRef" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_supplierRef_key" ON "ProductVariant"("supplierRef");
