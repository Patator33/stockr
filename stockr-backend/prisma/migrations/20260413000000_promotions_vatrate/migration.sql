-- Add vatRate to ProductVariant
ALTER TABLE "ProductVariant" ADD COLUMN "vatRate" REAL NOT NULL DEFAULT 20.0;

-- Add vatRate to Sale
ALTER TABLE "Sale" ADD COLUMN "vatRate" REAL NOT NULL DEFAULT 20.0;

-- Create Promotion table
CREATE TABLE "Promotion" (
  "id"        TEXT NOT NULL PRIMARY KEY,
  "variantId" TEXT NOT NULL,
  "price"     REAL NOT NULL,
  "startDate" DATETIME NOT NULL,
  "endDate"   DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Promotion_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
