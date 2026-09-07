-- AlterTable
ALTER TABLE "ChannelConfig" ADD COLUMN "vendorId" TEXT;

-- CreateIndex
CREATE INDEX "ChannelConfig_vendorId_isActive_idx" ON "ChannelConfig"("vendorId", "isActive");

-- AddForeignKey
ALTER TABLE "ChannelConfig" ADD CONSTRAINT "ChannelConfig_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
