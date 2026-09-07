-- Track contacts updated by re-import (upsert by mobile).
ALTER TABLE "ContactImportJob" ADD COLUMN "updated" INTEGER NOT NULL DEFAULT 0;
