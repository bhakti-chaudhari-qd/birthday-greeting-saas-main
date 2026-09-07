import { Channel, PrismaClient } from "@prisma/client";

import { resolveSmsProviderConfig } from "@/lib/channel-config/resolve";
import {
  isEncryptedStoredCredentials,
  LOCAL_SMS_PROVIDER_SETTINGS,
  LocalSmsConfigError,
  readLocalSmsEnv,
} from "@/lib/channel-config/local-sms-config";
import { resolveMessageProvider } from "@/lib/messaging/providers/factory";

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

  const configs = await prisma.channelConfig.findMany({
    where: {
      organizationId: organization.id,
      channel: "SMS",
    },
  });

  if (configs.length !== 1) {
    console.error(
      `Expected exactly one SMS ChannelConfig for the target organization, found ${configs.length}`,
    );
    process.exit(1);
  }

  const channelConfig = configs[0]!;
  const settings = channelConfig.settings as Record<string, unknown> | null;
  const credentialsEncrypted = isEncryptedStoredCredentials(
    channelConfig.encryptedCredentials,
  );

  let providerResolved = false;
  let decryptionSucceeded = false;

  try {
    const provider = resolveMessageProvider(channelConfig, Channel.SMS);
    providerResolved = provider.name === "CUSTOM_HTTP";

    resolveSmsProviderConfig(channelConfig);
    decryptionSucceeded = true;
  } catch {
    providerResolved = false;
    decryptionSucceeded = false;
  }

  const expectedSettings = {
    baseUrl: envInput.smsBaseUrl.replace(/\/$/, ""),
    sendPath: envInput.smsSendPath,
    route: envInput.smsRoute,
    senderId: envInput.smsSenderId,
    requestTimeoutMs: LOCAL_SMS_PROVIDER_SETTINGS.requestTimeoutMs,
  };

  const settingsMatchExpected =
    settings?.route === expectedSettings.route &&
    settings?.senderId === expectedSettings.senderId &&
    settings?.baseUrl === expectedSettings.baseUrl &&
    settings?.sendPath === expectedSettings.sendPath &&
    settings?.requestTimeoutMs === expectedSettings.requestTimeoutMs;

  const verification = {
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
    },
    smsChannelConfigCount: configs.length,
    provider: channelConfig.provider,
    route: settings?.route ?? null,
    senderId: settings?.senderId ?? null,
    sendPath: settings?.sendPath ?? null,
    baseUrl: settings?.baseUrl ?? null,
    requestTimeoutMs: settings?.requestTimeoutMs ?? null,
    credentialsEncrypted,
    credentialsPlaintext: !credentialsEncrypted,
    providerFactoryResolvedCustomHttp: providerResolved,
    credentialsDecryptSuccessfully: decryptionSucceeded,
    settingsMatchExpected,
    verified:
      configs.length === 1 &&
      channelConfig.provider === "CUSTOM_HTTP" &&
      credentialsEncrypted &&
      providerResolved &&
      decryptionSucceeded &&
      settingsMatchExpected,
  };

  console.log(JSON.stringify(verification));

  await prisma.$disconnect();

  if (!verification.verified) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Verification failed");
  process.exit(1);
});
