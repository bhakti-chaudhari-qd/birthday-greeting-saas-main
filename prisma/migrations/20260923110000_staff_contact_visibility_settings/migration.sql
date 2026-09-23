-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "staffContactVisibilityAdminAllowed" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "staffContactVisibilityOwnerAllowed" BOOLEAN NOT NULL DEFAULT false;
