-- AlterEnum
ALTER TYPE "Channel" ADD VALUE IF NOT EXISTS 'CALL';

-- CreateTable
CREATE TABLE IF NOT EXISTS "VoiceRecording" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteLength" INTEGER NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "providerFileId" TEXT,
    "providerFileKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoiceRecording_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "VoiceRecording_organizationId_createdAt_idx" ON "VoiceRecording"("organizationId", "createdAt");

-- AlterTable MessageTemplate
ALTER TABLE "MessageTemplate" ADD COLUMN IF NOT EXISTS "voiceRecordingId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MessageTemplate_voiceRecordingId_idx" ON "MessageTemplate"("voiceRecordingId");

-- AlterTable CategoryAutomationRule
ALTER TABLE "CategoryAutomationRule" ADD COLUMN IF NOT EXISTS "callTemplateId" TEXT;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "VoiceRecording" ADD CONSTRAINT "VoiceRecording_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "MessageTemplate" ADD CONSTRAINT "MessageTemplate_voiceRecordingId_fkey" FOREIGN KEY ("voiceRecordingId") REFERENCES "VoiceRecording"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CategoryAutomationRule" ADD CONSTRAINT "CategoryAutomationRule_callTemplateId_fkey" FOREIGN KEY ("callTemplateId") REFERENCES "MessageTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
