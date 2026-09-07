-- Remove in-app email verification (Keycloak will own verification later).
DELETE FROM "AuthToken" WHERE purpose = 'EMAIL_VERIFY';

ALTER TABLE "User" DROP COLUMN IF EXISTS "emailVerifiedAt";

CREATE TYPE "AuthTokenPurpose_new" AS ENUM ('PASSWORD_RESET');

ALTER TABLE "AuthToken"
  ALTER COLUMN "purpose" TYPE "AuthTokenPurpose_new"
  USING ("purpose"::text::"AuthTokenPurpose_new");

DROP TYPE "AuthTokenPurpose";

ALTER TYPE "AuthTokenPurpose_new" RENAME TO "AuthTokenPurpose";
