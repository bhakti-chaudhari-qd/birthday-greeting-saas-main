-- DropIndex
DROP INDEX "Contact_mobile_trgm_idx";

-- DropIndex
DROP INDEX "Contact_name_trgm_idx";

-- AlterTable
ALTER TABLE "BillingCheckout" ADD COLUMN     "dealEmailLimit" INTEGER,
ADD COLUMN     "dealSmsLimit" INTEGER,
ADD COLUMN     "dealWhatsappLimit" INTEGER;

-- AlterTable
ALTER TABLE "Subscription" ALTER COLUMN "contactLimit" SET DEFAULT 500,
ALTER COLUMN "monthlyMessageLimit" SET DEFAULT 500;

-- CreateTable
CREATE TABLE "ChannelMessageLimit" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "monthlyLimit" INTEGER NOT NULL,
    "messagesSentThisMonth" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelMessageLimit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChannelMessageLimit_subscriptionId_channel_key" ON "ChannelMessageLimit"("subscriptionId", "channel");

-- AddForeignKey
ALTER TABLE "ChannelMessageLimit" ADD CONSTRAINT "ChannelMessageLimit_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "Contact_organizationId_customOccasionMonth_customOccasionDay_id" RENAME TO "Contact_organizationId_customOccasionMonth_customOccasionDa_idx";
