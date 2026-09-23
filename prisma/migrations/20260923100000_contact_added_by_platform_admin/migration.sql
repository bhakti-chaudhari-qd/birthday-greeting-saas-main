-- Marks contacts created by a Platform Admin on a client's behalf (e.g.
-- onboarding import), so mobile/email can be masked from Staff users until
-- the client edits and saves the contact.
ALTER TABLE "Contact" ADD COLUMN "addedByPlatformAdmin" BOOLEAN NOT NULL DEFAULT false;
