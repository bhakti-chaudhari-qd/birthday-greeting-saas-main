-- CreateEnum
CREATE TYPE "ContactImportJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ContactImportFileFormat" AS ENUM ('CSV', 'XLSX');

-- CreateTable
CREATE TABLE "ContactImportJob" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileFormat" "ContactImportFileFormat" NOT NULL,
    "status" "ContactImportJobStatus" NOT NULL DEFAULT 'PENDING',
    "fileBytes" BYTEA NOT NULL,
    "parsedCache" BYTEA,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "processedRows" INTEGER NOT NULL DEFAULT 0,
    "nextRowIndex" INTEGER NOT NULL DEFAULT 0,
    "created" INTEGER NOT NULL DEFAULT 0,
    "skippedDuplicate" INTEGER NOT NULL DEFAULT 0,
    "skippedLimit" INTEGER NOT NULL DEFAULT 0,
    "invalid" INTEGER NOT NULL DEFAULT 0,
    "claimedAt" TIMESTAMP(3),
    "leaseExpiresAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactImportJobError" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "row" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactImportJobError_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContactImportJob_organizationId_status_idx" ON "ContactImportJob"("organizationId", "status");

-- CreateIndex
CREATE INDEX "ContactImportJob_status_leaseExpiresAt_idx" ON "ContactImportJob"("status", "leaseExpiresAt");

-- CreateIndex
CREATE INDEX "ContactImportJobError_jobId_row_idx" ON "ContactImportJobError"("jobId", "row");

-- AddForeignKey
ALTER TABLE "ContactImportJob" ADD CONSTRAINT "ContactImportJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactImportJobError" ADD CONSTRAINT "ContactImportJobError_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ContactImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
