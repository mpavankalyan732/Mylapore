UPDATE "Payment" SET "method" = 'CARD' WHERE "method" IS NULL;

ALTER TABLE "Payment"
  ALTER COLUMN "method" SET DEFAULT 'CARD',
  ALTER COLUMN "method" SET NOT NULL;
