CREATE TABLE "WhatsAppMediaAsset" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteLength" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppMediaAsset_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MessageTemplate"
ADD COLUMN "whatsappMediaAssetId" TEXT;

ALTER TABLE "SendQueue"
ADD COLUMN "whatsappMediaAssetId" TEXT;

CREATE INDEX "WhatsAppMediaAsset_organizationId_createdAt_idx"
ON "WhatsAppMediaAsset"("organizationId", "createdAt");

CREATE INDEX "WhatsAppMediaAsset_organizationId_checksum_idx"
ON "WhatsAppMediaAsset"("organizationId", "checksum");

CREATE INDEX "MessageTemplate_whatsappMediaAssetId_idx"
ON "MessageTemplate"("whatsappMediaAssetId");

CREATE INDEX "SendQueue_whatsappMediaAssetId_idx"
ON "SendQueue"("whatsappMediaAssetId");

ALTER TABLE "WhatsAppMediaAsset"
ADD CONSTRAINT "WhatsAppMediaAsset_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MessageTemplate"
ADD CONSTRAINT "MessageTemplate_whatsappMediaAssetId_fkey"
FOREIGN KEY ("whatsappMediaAssetId") REFERENCES "WhatsAppMediaAsset"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SendQueue"
ADD CONSTRAINT "SendQueue_whatsappMediaAssetId_fkey"
FOREIGN KEY ("whatsappMediaAssetId") REFERENCES "WhatsAppMediaAsset"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
