-- Platform Admin's Meta Cloud API account + template for the daily summary.
CREATE TABLE "PlatformDailySummaryConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "encryptedAccessToken" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "apiVersion" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "sendHour" INTEGER NOT NULL DEFAULT 9,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformDailySummaryConfig_pkey" PRIMARY KEY ("id")
);
