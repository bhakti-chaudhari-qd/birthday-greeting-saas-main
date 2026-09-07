-- Align default organization timezone with India-first automation (IST).
ALTER TABLE "Organization" ALTER COLUMN "timezone" SET DEFAULT 'Asia/Kolkata';
