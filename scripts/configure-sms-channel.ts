import { PrismaClient } from "@prisma/client";

import {
  buildLocalSmsChannelConfig,
  LocalSmsConfigError,
  readLocalSmsEnv,
} from "@/lib/channel-config/local-sms-config";

import { loadLocalEnv } from "./load-local-env";

async function main() {
  loadLocalEnv();

  let envInput;

  try {
    envInput = readLocalSmsEnv();
  } catch (error) {
    if (error instanceof LocalSmsConfigError) {
      console.error(error.message);
      process.exit(1);
    }

    throw error;
  }

  const prisma = new PrismaClient();
  const organization = envInput.organizationId
    ? await prisma.organization.findUnique({
        where: { id: envInput.organizationId },
        select: { id: true, name: true, slug: true },
      })
    : await prisma.organization.findUnique({
        where: { slug: envInput.organizationSlug },
        select: { id: true, name: true, slug: true },
      });

  if (!organization) {
    console.error("Target development organization was not found");
    process.exit(1);
  }

  const config = buildLocalSmsChannelConfig(envInput);

  const channelConfig = await prisma.channelConfig.upsert({
    where: {
      organizationId_channel: {
        organizationId: organization.id,
        channel: config.channel,
      },
    },
    create: {
      organizationId: organization.id,
      ...config,
    },
    update: {
      provider: config.provider,
      encryptedCredentials: config.encryptedCredentials,
      settings: config.settings,
      isActive: config.isActive,
    },
    select: {
      id: true,
      organizationId: true,
      channel: true,
      provider: true,
      settings: true,
      isActive: true,
      encryptedCredentials: true,
    },
  });

  console.log(
    JSON.stringify({
      configured: true,
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
      },
      channelConfig: {
        id: channelConfig.id,
        channel: channelConfig.channel,
        provider: channelConfig.provider,
        settings: channelConfig.settings,
        isActive: channelConfig.isActive,
        credentialsEncrypted: channelConfig.encryptedCredentials.startsWith(
          "enc:v1:",
        ),
      },
    }),
  );

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Configuration failed");
  process.exit(1);
});
