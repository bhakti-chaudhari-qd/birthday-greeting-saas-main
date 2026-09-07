-- Allow unset automation send times (no default 6:00 AM).
-- Existing rows keep their current hour/minute values.

ALTER TABLE "Organization" ALTER COLUMN "automationSendHour" DROP DEFAULT;
ALTER TABLE "Organization" ALTER COLUMN "automationSendHour" DROP NOT NULL;
ALTER TABLE "Organization" ALTER COLUMN "automationSendMinute" DROP DEFAULT;
ALTER TABLE "Organization" ALTER COLUMN "automationSendMinute" DROP NOT NULL;

ALTER TABLE "CategoryAutomationRule" ALTER COLUMN "sendHour" DROP DEFAULT;
ALTER TABLE "CategoryAutomationRule" ALTER COLUMN "sendHour" DROP NOT NULL;
ALTER TABLE "CategoryAutomationRule" ALTER COLUMN "sendMinute" DROP DEFAULT;
ALTER TABLE "CategoryAutomationRule" ALTER COLUMN "sendMinute" DROP NOT NULL;
