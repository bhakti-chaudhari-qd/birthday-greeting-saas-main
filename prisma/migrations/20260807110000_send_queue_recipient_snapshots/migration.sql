ALTER TABLE "SendQueue" ADD COLUMN "recipientName" TEXT;
ALTER TABLE "SendQueue" ADD COLUMN "recipientMobile" TEXT;
ALTER TABLE "SendQueue" ADD COLUMN "recipientEmail" TEXT;

UPDATE "SendQueue" AS queue
SET
  "recipientName" = contact."name",
  "recipientMobile" = contact."mobile",
  "recipientEmail" = contact."email"
FROM "Contact" AS contact
WHERE queue."contactId" = contact."id";

ALTER TABLE "SendQueue" ALTER COLUMN "recipientName" SET NOT NULL;
ALTER TABLE "SendQueue" ALTER COLUMN "recipientMobile" SET NOT NULL;
ALTER TABLE "SendQueue" ALTER COLUMN "contactId" DROP NOT NULL;
