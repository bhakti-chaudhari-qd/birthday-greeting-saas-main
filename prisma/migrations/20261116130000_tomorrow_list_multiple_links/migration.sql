-- Allow several links per organization per day (scheduled send + "Send now"),
-- so sending again no longer invalidates a link already delivered.
DROP INDEX "TomorrowListLink_organizationId_forDate_key";
CREATE INDEX "TomorrowListLink_organizationId_forDate_idx" ON "TomorrowListLink"("organizationId", "forDate");
