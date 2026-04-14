-- Add per-supplier reference to VariantSupplierPrice
ALTER TABLE "VariantSupplierPrice" ADD COLUMN "supplierRef" TEXT;
