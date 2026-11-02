/**
 * Create a demo/test client organization that reuses a WhatsApp number
 * already registered to another client.
 *
 * User.mobile is globally unique, so the signup form refuses a number that is
 * already in use. Client users sign in by email only, so the demo account is
 * created with no login mobile and the shared number set as its WhatsApp
 * number (which is not unique).
 *
 * Usage:
 *   DEMO_EMAIL=demo@example.com \
 *   DEMO_PASSWORD='...' \
 *   DEMO_WHATSAPP=9876543210 \
 *   DEMO_ORG_NAME='Demo Client' \
 *   DEMO_ADMIN_NAME='Demo Admin' \
 *   npx tsx scripts/create-demo-client.ts
 */
import { loadLocalEnv } from "./load-local-env";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

async function main() {
  loadLocalEnv();

  const email = requireEnv("DEMO_EMAIL").toLowerCase();
  const password = requireEnv("DEMO_PASSWORD");
  const whatsappNumber = requireEnv("DEMO_WHATSAPP");
  const organizationName = process.env.DEMO_ORG_NAME?.trim() || "Demo Client";
  const adminName = process.env.DEMO_ADMIN_NAME?.trim() || "Demo Admin";

  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("Missing DATABASE_URL");
  }

  const { prisma } = await import("@/lib/db");
  const { createRegisteredOrganization } = await import("@/lib/auth/register");
  const { registerSchema } = await import("@/lib/validation/auth");

  try {
    const input = registerSchema.parse({
      organizationName,
      adminName,
      email,
      password,
      whatsappNumber,
    });
    const { organization, user } = await createRegisteredOrganization(input);

    console.log("Demo client ready:");
    console.log(`  organization: ${organization.name} (${organization.slug})`);
    console.log(`  login email: ${user.email}`);
    console.log(`  whatsapp: ${user.whatsappNumber}`);
    console.log("Sign in at /login with the email and password.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
