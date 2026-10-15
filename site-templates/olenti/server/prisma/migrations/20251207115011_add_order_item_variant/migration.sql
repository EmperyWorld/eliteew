-- Add variantId and volume to order_items
ALTER TABLE "order_items"
  ADD COLUMN "variantId" TEXT,
  ADD COLUMN "volume" TEXT;

-- Link to product_variants (nullable, set null on delete)
ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
