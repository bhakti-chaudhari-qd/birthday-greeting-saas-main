-- Faster partial name/mobile search for large contact lists
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Contact_name_trgm_idx" ON "Contact" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Contact_mobile_trgm_idx" ON "Contact" USING gin ("mobile" gin_trgm_ops);
