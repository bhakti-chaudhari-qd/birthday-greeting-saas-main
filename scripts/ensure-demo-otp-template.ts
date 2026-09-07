/**
 * Ensure the demo Live OTP (DLT-ready) template exists on seeded demo orgs.
 *
 * Usage:
 *   npm run sms:ensure-demo-otp
 *   SMS_CONFIG_ORGANIZATION_SLUG=acme-corp-demo npm run sms:ensure-demo-otp
 *
 * By default updates: acme-corp, beta-inc, and SMS_CONFIG_ORGANIZATION_SLUG
 * (default acme-corp-demo) when that org exists.
 */
import { PrismaClient } from "@prisma/client";

import { ensureDemoLiveOtpTemplate } from "@/lib/templates/demo-live-otp";
import { deriveRealSmsReadiness } from "@/lib/templates/readiness";

import { loadLocalEnv } from "./load-local-env";

async function main() {
  loadLocalEnv();

  const prisma = new PrismaClient();
  const slugs = new Set(["acme-corp", "beta-inc"]);
  const configuredSlug =
    process.env.SMS_CONFIG_ORGANIZATION_SLUG?.trim() || "acme-corp-demo";
  slugs.add(configuredSlug);

  try {
    for (const slug of slugs) {
      const organization = await prisma.organization.findUnique({
        where: { slug },
        select: { id: true, name: true, slug: true },
      });

      if (!organization) {
        console.log(`Skipping missing organization: ${slug}`);
        continue;
      }

      const template = await ensureDemoLiveOtpTemplate(prisma, organization.id);
      const readiness = deriveRealSmsReadiness(template);

      console.log(`Organization: ${organization.name} (${organization.slug})`);
      console.log(`Template: ${template.name} (${template.id})`);
      console.log(`DLT Template ID: ${template.dltTemplateId}`);
      console.log(`Status: ${readiness.realSmsStatusLabel}`);
      if (!readiness.realSmsReady) {
        console.log("Issues:");
        for (const issue of readiness.realSmsReadinessIssues) {
          console.log(`  - ${issue}`);
        }
      }
      console.log("---");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
