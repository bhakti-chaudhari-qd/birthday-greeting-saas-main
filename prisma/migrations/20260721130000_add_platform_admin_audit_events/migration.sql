-- CreateTable
CREATE TABLE "PlatformAdminAuditEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorAdminId" TEXT,
    "organizationId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,

    CONSTRAINT "PlatformAdminAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformAdminAuditEvent_organizationId_createdAt_idx" ON "PlatformAdminAuditEvent"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "PlatformAdminAuditEvent_actorAdminId_createdAt_idx" ON "PlatformAdminAuditEvent"("actorAdminId", "createdAt");

-- CreateIndex
CREATE INDEX "PlatformAdminAuditEvent_action_createdAt_idx" ON "PlatformAdminAuditEvent"("action", "createdAt");

-- CreateIndex
CREATE INDEX "PlatformAdminAuditEvent_targetType_targetId_createdAt_idx" ON "PlatformAdminAuditEvent"("targetType", "targetId", "createdAt");

-- AddForeignKey
ALTER TABLE "PlatformAdminAuditEvent" ADD CONSTRAINT "PlatformAdminAuditEvent_actorAdminId_fkey" FOREIGN KEY ("actorAdminId") REFERENCES "PlatformAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformAdminAuditEvent" ADD CONSTRAINT "PlatformAdminAuditEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
