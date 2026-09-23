-- Admin ceiling for Staff contact visibility now defaults to OFF (must be
-- explicitly turned on per client), not ON. Backfills existing orgs too,
-- since this setting had not been meaningfully used yet.
ALTER TABLE "Organization" ALTER COLUMN "staffContactVisibilityAdminAllowed" SET DEFAULT false;
UPDATE "Organization" SET "staffContactVisibilityAdminAllowed" = false;
