-- Remove unused contact tags

ALTER TABLE "Contact" DROP COLUMN IF EXISTS "tags";
