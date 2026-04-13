-- Add lowStockThreshold to ProductVariant
ALTER TABLE "ProductVariant" ADD COLUMN "lowStockThreshold" INTEGER;

-- Add orderId to Sale (link to Order)
ALTER TABLE "Sale" ADD COLUMN "orderId" TEXT REFERENCES "Order"("id") ON DELETE SET NULL;

-- StockMovement table
CREATE TABLE "StockMovement" (
  "id"         TEXT     NOT NULL PRIMARY KEY,
  "variantId"  TEXT     NOT NULL,
  "locationId" TEXT     NOT NULL,
  "type"       TEXT     NOT NULL,
  "delta"      INTEGER  NOT NULL,
  "userId"     TEXT,
  "ref"        TEXT,
  "notes"      TEXT,
  "createdAt"  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockMovement_variantId_fkey"  FOREIGN KEY ("variantId")  REFERENCES "ProductVariant"    ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StockMovement_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "StorageLocation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Setting table (key-value store)
CREATE TABLE "Setting" (
  "key"       TEXT     NOT NULL PRIMARY KEY,
  "value"     TEXT     NOT NULL,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Default settings
INSERT INTO "Setting" ("key", "value", "updatedAt") VALUES ('defaultVatRate', '20', CURRENT_TIMESTAMP);
INSERT INTO "Setting" ("key", "value", "updatedAt") VALUES ('lowStockDays', '7', CURRENT_TIMESTAMP);
