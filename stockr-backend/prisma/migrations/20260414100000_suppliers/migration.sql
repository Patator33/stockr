-- Create Supplier table
CREATE TABLE "Supplier" (
  "id"          TEXT NOT NULL PRIMARY KEY,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Supplier_name_key" ON "Supplier"("name");

-- Create VariantSupplierPrice table
CREATE TABLE "VariantSupplierPrice" (
  "id"           TEXT NOT NULL PRIMARY KEY,
  "variantId"    TEXT NOT NULL,
  "supplierId"   TEXT NOT NULL,
  "salePrice"    REAL NOT NULL,
  "costPrice"    REAL NOT NULL DEFAULT 0,
  "shippingCost" REAL NOT NULL DEFAULT 0,
  "vatRate"      REAL NOT NULL DEFAULT 20,
  "createdAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VariantSupplierPrice_variantId_fkey"  FOREIGN KEY ("variantId")  REFERENCES "ProductVariant" ("id") ON DELETE CASCADE,
  CONSTRAINT "VariantSupplierPrice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "VariantSupplierPrice_variantId_supplierId_key" ON "VariantSupplierPrice"("variantId", "supplierId");

-- Add supplierId to Sale
ALTER TABLE "Sale" ADD COLUMN "supplierId" TEXT REFERENCES "Supplier"("id") ON DELETE SET NULL;

-- Add supplierId to Promotion
ALTER TABLE "Promotion" ADD COLUMN "supplierId" TEXT REFERENCES "Supplier"("id") ON DELETE CASCADE;
