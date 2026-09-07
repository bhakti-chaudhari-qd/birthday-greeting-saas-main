import {
  Channel,
  ChannelProvider,
  DeliveryStatus,
  PrismaClient,
  QueueStatus,
  SubscriptionPlan,
  SubscriptionStatus,
  UserRole,
  VendorOnboardingStatus,
} from "@prisma/client";
import { hash } from "bcryptjs";

import { ensureDefaultContactCategories } from "../src/lib/contacts/categories";
import {
  createOccasion,
  ensureSystemBirthdayOccasion,
} from "../src/lib/occasions/service";
import { assertSeedAllowed } from "../src/lib/ops/seed-guard";
import { ensureDemoLiveOtpTemplate } from "../src/lib/templates/demo-live-otp";

assertSeedAllowed();

const prisma = new PrismaClient();

/** Local demo only - seed refuses NODE_ENV=production (see assertSeedAllowed). */
const SEED_PASSWORD = "password123";

type SeedDelivery = {
  key: string;
  contactMobile: string;
  channel: Channel;
  status: QueueStatus;
  deliveryStatus: DeliveryStatus;
  daysAgo: number;
  errorMessage?: string;
};

async function upsertOrgUser(input: {
  organizationId: string;
  email: string;
  name: string;
  role: UserRole;
  passwordHash: string;
}) {
  return prisma.user.upsert({
    where: { email: input.email },
    update: {
      name: input.name,
      role: input.role,
      passwordHash: input.passwordHash,
      isActive: true,
      organizationId: input.organizationId,
    },
    create: {
      organizationId: input.organizationId,
      email: input.email,
      name: input.name,
      role: input.role,
      passwordHash: input.passwordHash,
    },
  });
}

/** Find-or-create the org's "Anniversary" occasion (not a system occasion - user-managed like any other). */
async function ensureAnniversaryOccasion(
  organizationId: string,
): Promise<{ id: string; name: string }> {
  const existing = await prisma.occasion.findFirst({
    where: {
      organizationId,
      name: { equals: "Anniversary", mode: "insensitive" },
    },
    select: { id: true, name: true },
  });
  if (existing) {
    return existing;
  }
  const created = await createOccasion(organizationId, "Anniversary");
  return { id: created.id, name: created.name };
}

async function upsertContact(input: {
  organizationId: string;
  name: string;
  mobile: string;
  categoryName?: string;
  birthdayOccasionId?: string;
  birthMonth?: number;
  birthDay?: number;
}) {
  let categoryId: string | null = null;
  if (input.categoryName) {
    const category = await prisma.contactCategoryDefinition.findFirst({
      where: {
        organizationId: input.organizationId,
        name: { equals: input.categoryName, mode: "insensitive" },
      },
      select: { id: true },
    });
    categoryId = category?.id ?? null;
    if (!categoryId) {
      const created = await prisma.contactCategoryDefinition.create({
        data: {
          organizationId: input.organizationId,
          name: input.categoryName,
        },
        select: { id: true },
      });
      categoryId = created.id;
    }
  }

  const contact = await prisma.contact.upsert({
    where: {
      organizationId_mobile: {
        organizationId: input.organizationId,
        mobile: input.mobile,
      },
    },
    update: {
      name: input.name,
      categoryId,
      isActive: true,
    },
    create: {
      organizationId: input.organizationId,
      name: input.name,
      mobile: input.mobile,
      categoryId,
    },
  });

  if (input.birthdayOccasionId && input.birthMonth && input.birthDay) {
    const date = new Date(Date.UTC(2000, input.birthMonth - 1, input.birthDay));
    await prisma.contactOccasionDate.upsert({
      where: {
        contactId_occasionId: {
          contactId: contact.id,
          occasionId: input.birthdayOccasionId,
        },
      },
      update: { date, month: input.birthMonth, day: input.birthDay },
      create: {
        organizationId: input.organizationId,
        contactId: contact.id,
        occasionId: input.birthdayOccasionId,
        date,
        month: input.birthMonth,
        day: input.birthDay,
      },
    });
  }

  return contact;
}

async function upsertBirthdayTemplate(
  organizationId: string,
  channel: Channel,
  occasionId: string,
) {
  const name =
    channel === Channel.SMS ? "Seed Birthday SMS" : "Seed Birthday WhatsApp";
  const existing = await prisma.messageTemplate.findFirst({
    where: { organizationId, name, channel },
  });

  if (existing) {
    return prisma.messageTemplate.update({
      where: { id: existing.id },
      data: {
        occasionId,
        body: "Happy Birthday {{name}}! - from the seed demo.",
        variables: ["name"],
        isActive: true,
        categoryId: null,
      },
    });
  }

  return prisma.messageTemplate.create({
    data: {
      organizationId,
      name,
      occasionId,
      channel,
      body: "Happy Birthday {{name}}! - from the seed demo.",
      variables: ["name"],
      isActive: true,
    },
  });
}

const SEED_CATEGORY_NAMES = ["VVIP", "VIP", "Relative", "Friend"] as const;
type SeedCategoryName = (typeof SEED_CATEGORY_NAMES)[number];

type SeedOccasionName = "Birthday" | "Anniversary";

/** Unique middle copy per occasion × category (prefix adds Occasion · Category). */
const SEED_CATEGORY_TEMPLATE_LINES: Record<
  SeedOccasionName,
  Record<SeedCategoryName, string>
> = {
  Birthday: {
    VVIP: "Dear {{name}}, wishing our most valued guest a magnificent birthday!",
    VIP: "Happy Birthday {{name}}! Celebrating you as a VIP today.",
    Relative: "Happy Birthday {{name}}! Warm wishes from the family circle.",
    Friend: "Hey {{name}}, happy birthday! Grateful for your friendship.",
  },
  Anniversary: {
    VVIP: "Dear {{name}}, congratulations on another distinguished anniversary!",
    VIP: "Happy Anniversary {{name}}! Honoured to celebrate this VIP milestone.",
    Relative: "Happy Anniversary {{name}}! Love and blessings from the family.",
    Friend:
      "Cheers {{name}} - happy anniversary! Glad to celebrate with a friend.",
  },
};

function seedChannelLabel(channel: Channel): string {
  return channel === Channel.WHATSAPP ? "WhatsApp" : "SMS";
}

function seedCategoryTemplateBody(
  occasionName: SeedOccasionName,
  categoryName: SeedCategoryName,
): string {
  return SEED_CATEGORY_TEMPLATE_LINES[occasionName][categoryName];
}

async function upsertCategoryDemoTemplate(input: {
  organizationId: string;
  categoryId: string;
  categoryName: SeedCategoryName;
  occasionId: string;
  occasionName: SeedOccasionName;
  channel: Channel;
}) {
  const name = `Seed ${input.occasionName} ${input.categoryName} ${seedChannelLabel(input.channel)}`;
  const body = seedCategoryTemplateBody(input.occasionName, input.categoryName);
  const existing = await prisma.messageTemplate.findFirst({
    where: {
      organizationId: input.organizationId,
      name,
      channel: input.channel,
    },
  });

  if (existing) {
    return prisma.messageTemplate.update({
      where: { id: existing.id },
      data: {
        occasionId: input.occasionId,
        body,
        variables: ["name"],
        isActive: true,
        categoryId: input.categoryId,
      },
    });
  }

  return prisma.messageTemplate.create({
    data: {
      organizationId: input.organizationId,
      name,
      occasionId: input.occasionId,
      channel: input.channel,
      body,
      variables: ["name"],
      isActive: true,
      categoryId: input.categoryId,
    },
  });
}

/**
 * Creates distinct SMS (and optional WhatsApp) templates for every default
 * category × occasion, then enables greeting routes so catch-up covers all groups.
 */
async function seedCategoryDemoTemplatesAndRoutes(input: {
  organizationId: string;
  channels: Channel[];
}) {
  const [birthdayOccasion, anniversaryOccasion] = await Promise.all([
    ensureSystemBirthdayOccasion(input.organizationId),
    ensureAnniversaryOccasion(input.organizationId),
  ]);
  const occasions: Array<{ id: string; name: SeedOccasionName }> = [
    { id: birthdayOccasion.id, name: "Birthday" },
    { id: anniversaryOccasion.id, name: "Anniversary" },
  ];

  const categories = await prisma.contactCategoryDefinition.findMany({
    where: {
      organizationId: input.organizationId,
      name: { in: [...SEED_CATEGORY_NAMES] },
    },
    select: { id: true, name: true },
  });

  const categoryByName = new Map(
    categories.map((category) => [
      category.name as SeedCategoryName,
      category,
    ]),
  );

  for (const categoryName of SEED_CATEGORY_NAMES) {
    const category = categoryByName.get(categoryName);
    if (!category) {
      throw new Error(
        `Missing seed category ${categoryName} on org ${input.organizationId}`,
      );
    }

    for (const occasion of occasions) {
      const templatesByChannel = new Map<Channel, string>();

      for (const channel of input.channels) {
        if (channel !== Channel.SMS && channel !== Channel.WHATSAPP) {
          continue;
        }
        const template = await upsertCategoryDemoTemplate({
          organizationId: input.organizationId,
          categoryId: category.id,
          categoryName,
          occasionId: occasion.id,
          occasionName: occasion.name,
          channel,
        });
        templatesByChannel.set(channel, template.id);
      }

      const smsTemplateId = templatesByChannel.get(Channel.SMS) ?? null;
      const whatsappTemplateId =
        templatesByChannel.get(Channel.WHATSAPP) ?? null;

      const ruleData = {
        sendHour: 6,
        sendMinute: 0,
        smsEnabled: Boolean(smsTemplateId),
        smsTemplateId,
        whatsappEnabled: Boolean(whatsappTemplateId),
        whatsappTemplateId,
        emailEnabled: false,
        emailTemplateId: null,
      };

      const existingRule = await prisma.categoryAutomationRule.findFirst({
        where: {
          organizationId: input.organizationId,
          occasionId: occasion.id,
          categoryId: category.id,
        },
      });

      if (existingRule) {
        await prisma.categoryAutomationRule.update({
          where: { id: existingRule.id },
          data: ruleData,
        });
      } else {
        await prisma.categoryAutomationRule.create({
          data: {
            organizationId: input.organizationId,
            occasionId: occasion.id,
            categoryId: category.id,
            ...ruleData,
          },
        });
      }
    }
  }
}

async function upsertChannelConfig(input: {
  organizationId: string;
  channel: Channel;
  provider: ChannelProvider;
  vendorId: string | null;
}) {
  return prisma.channelConfig.upsert({
    where: {
      organizationId_channel: {
        organizationId: input.organizationId,
        channel: input.channel,
      },
    },
    update: {
      provider: input.provider,
      encryptedCredentials: "seed:test-credentials",
      isActive: true,
      vendorId: input.vendorId,
    },
    create: {
      organizationId: input.organizationId,
      channel: input.channel,
      provider: input.provider,
      encryptedCredentials: "seed:test-credentials",
      isActive: true,
      vendorId: input.vendorId,
    },
  });
}

async function upsertSeedDelivery(input: {
  organizationId: string;
  contactId: string;
  templateId: string;
  occasionId: string;
  delivery: SeedDelivery;
}) {
  const scheduledDate = new Date();
  scheduledDate.setUTCHours(0, 0, 0, 0);
  scheduledDate.setUTCDate(scheduledDate.getUTCDate() - input.delivery.daysAgo);

  const sentAt =
    input.delivery.status === QueueStatus.PENDING
      ? null
      : new Date(Date.now() - input.delivery.daysAgo * 24 * 60 * 60 * 1000);
  const contact = await prisma.contact.findUniqueOrThrow({
    where: { id: input.contactId },
    select: { name: true, mobile: true, email: true },
  });

  const queue = await prisma.sendQueue.upsert({
    where: {
      organizationId_idempotencyKey: {
        organizationId: input.organizationId,
        idempotencyKey: input.delivery.key,
      },
    },
    update: {
      contactId: input.contactId,
      recipientName: contact.name,
      recipientMobile: contact.mobile,
      recipientEmail: contact.email,
      templateId: input.templateId,
      channel: input.delivery.channel,
      occasionId: input.occasionId,
      scheduledDate,
      renderedBody: "Happy Birthday (seed demo)!",
      status: input.delivery.status,
      attemptCount: input.delivery.status === QueueStatus.PENDING ? 0 : 1,
      lastError: input.delivery.errorMessage ?? null,
      sentAt,
    },
    create: {
      organizationId: input.organizationId,
      contactId: input.contactId,
      recipientName: contact.name,
      recipientMobile: contact.mobile,
      recipientEmail: contact.email,
      templateId: input.templateId,
      channel: input.delivery.channel,
      occasionId: input.occasionId,
      scheduledDate,
      renderedBody: "Happy Birthday (seed demo)!",
      status: input.delivery.status,
      idempotencyKey: input.delivery.key,
      attemptCount: input.delivery.status === QueueStatus.PENDING ? 0 : 1,
      lastError: input.delivery.errorMessage ?? null,
      sentAt,
    },
  });

  if (input.delivery.status === QueueStatus.PENDING) {
    await prisma.deliveryLog.deleteMany({ where: { sendQueueId: queue.id } });
    return queue;
  }

  const existingLog = await prisma.deliveryLog.findFirst({
    where: { sendQueueId: queue.id, attemptNumber: 1 },
  });

  if (existingLog) {
    await prisma.deliveryLog.update({
      where: { id: existingLog.id },
      data: {
        status: input.delivery.deliveryStatus,
        errorMessage: input.delivery.errorMessage ?? null,
        providerMessageId: `seed-msg-${input.delivery.key}`,
        createdAt: sentAt ?? new Date(),
      },
    });
  } else {
    await prisma.deliveryLog.create({
      data: {
        organizationId: input.organizationId,
        sendQueueId: queue.id,
        attemptNumber: 1,
        status: input.delivery.deliveryStatus,
        errorMessage: input.delivery.errorMessage ?? null,
        providerMessageId: `seed-msg-${input.delivery.key}`,
        createdAt: sentAt ?? new Date(),
      },
    });
  }

  return queue;
}

async function main() {
  const passwordHash = await hash(SEED_PASSWORD, 12);

  const orgA = await prisma.organization.upsert({
    where: { slug: "acme-corp" },
    update: {
      name: "Acme Corp",
      timezone: "Asia/Kolkata",
      isActive: true,
    },
    create: {
      name: "Acme Corp",
      slug: "acme-corp",
      timezone: "Asia/Kolkata",
      subscription: {
        create: {
          plan: SubscriptionPlan.STARTER,
          status: SubscriptionStatus.ACTIVE,
          contactLimit: 1_000,
          monthlyMessageLimit: 10_000,
          messagesSentThisMonth: 128,
        },
      },
    },
  });

  const orgB = await prisma.organization.upsert({
    where: { slug: "beta-inc" },
    update: {
      name: "Beta Inc",
      timezone: "UTC",
      isActive: true,
    },
    create: {
      name: "Beta Inc",
      slug: "beta-inc",
      timezone: "UTC",
      subscription: {
        create: {
          // Local large-import testing for admin@beta.test
          plan: SubscriptionPlan.CUSTOM,
          status: SubscriptionStatus.ACTIVE,
          contactLimit: 500_000,
          monthlyMessageLimit: 500_000,
          messagesSentThisMonth: 34,
        },
      },
    },
  });

  const orgC = await prisma.organization.upsert({
    where: { slug: "gamma-retail" },
    update: {
      name: "Gamma Retail",
      timezone: "Asia/Kolkata",
      isActive: true,
    },
    create: {
      name: "Gamma Retail",
      slug: "gamma-retail",
      timezone: "Asia/Kolkata",
      subscription: {
        create: {
          plan: SubscriptionPlan.PRO,
          status: SubscriptionStatus.ACTIVE,
          contactLimit: 10_000,
          monthlyMessageLimit: 100_000,
          messagesSentThisMonth: 1_842,
        },
      },
    },
  });

  const orgD = await prisma.organization.upsert({
    where: { slug: "delta-holdings" },
    update: {
      name: "Delta Holdings",
      timezone: "UTC",
      isActive: false,
    },
    create: {
      name: "Delta Holdings",
      slug: "delta-holdings",
      timezone: "UTC",
      isActive: false,
      subscription: {
        create: {
          plan: SubscriptionPlan.CUSTOM,
          status: SubscriptionStatus.CANCELLED,
          contactLimit: 50_000,
          monthlyMessageLimit: 100_000,
          messagesSentThisMonth: 0,
        },
      },
    },
  });

  await ensureDefaultContactCategories(orgA.id);
  await ensureDefaultContactCategories(orgB.id);
  await ensureDefaultContactCategories(orgC.id);
  await ensureDefaultContactCategories(orgD.id);

  const birthdayA = await ensureSystemBirthdayOccasion(orgA.id);
  const birthdayB = await ensureSystemBirthdayOccasion(orgB.id);
  const birthdayC = await ensureSystemBirthdayOccasion(orgC.id);
  await ensureSystemBirthdayOccasion(orgD.id);

  await prisma.subscription.upsert({
    where: { organizationId: orgA.id },
    update: {
      plan: SubscriptionPlan.STARTER,
      status: SubscriptionStatus.ACTIVE,
      contactLimit: 1_000,
      monthlyMessageLimit: 10_000,
      messagesSentThisMonth: 128,
    },
    create: {
      organizationId: orgA.id,
      plan: SubscriptionPlan.STARTER,
      status: SubscriptionStatus.ACTIVE,
      contactLimit: 1_000,
      monthlyMessageLimit: 10_000,
      messagesSentThisMonth: 128,
    },
  });

  await prisma.subscription.upsert({
    where: { organizationId: orgB.id },
    update: {
      // Local large-import testing for admin@beta.test
      plan: SubscriptionPlan.CUSTOM,
      status: SubscriptionStatus.ACTIVE,
      contactLimit: 500_000,
      monthlyMessageLimit: 500_000,
      messagesSentThisMonth: 34,
    },
    create: {
      organizationId: orgB.id,
      plan: SubscriptionPlan.CUSTOM,
      status: SubscriptionStatus.ACTIVE,
      contactLimit: 500_000,
      monthlyMessageLimit: 500_000,
      messagesSentThisMonth: 34,
    },
  });

  await prisma.subscription.upsert({
    where: { organizationId: orgC.id },
    update: {
      plan: SubscriptionPlan.PRO,
      status: SubscriptionStatus.ACTIVE,
      contactLimit: 10_000,
      monthlyMessageLimit: 100_000,
      messagesSentThisMonth: 1_842,
    },
    create: {
      organizationId: orgC.id,
      plan: SubscriptionPlan.PRO,
      status: SubscriptionStatus.ACTIVE,
      contactLimit: 10_000,
      monthlyMessageLimit: 100_000,
      messagesSentThisMonth: 1_842,
    },
  });

  await prisma.subscription.upsert({
    where: { organizationId: orgD.id },
    update: {
      plan: SubscriptionPlan.CUSTOM,
      status: SubscriptionStatus.CANCELLED,
      contactLimit: 50_000,
      monthlyMessageLimit: 100_000,
      messagesSentThisMonth: 0,
    },
    create: {
      organizationId: orgD.id,
      plan: SubscriptionPlan.CUSTOM,
      status: SubscriptionStatus.CANCELLED,
      contactLimit: 50_000,
      monthlyMessageLimit: 100_000,
      messagesSentThisMonth: 0,
    },
  });

  await upsertOrgUser({
    organizationId: orgA.id,
    email: "admin@acme.test",
    name: "Acme Admin",
    role: UserRole.ADMIN,
    passwordHash,
  });
  await upsertOrgUser({
    organizationId: orgA.id,
    email: "staff@acme.test",
    name: "Acme Staff",
    role: UserRole.STAFF,
    passwordHash,
  });
  await upsertOrgUser({
    organizationId: orgB.id,
    email: "admin@beta.test",
    name: "Beta Admin",
    role: UserRole.ADMIN,
    passwordHash,
  });
  await upsertOrgUser({
    organizationId: orgC.id,
    email: "admin@gamma.test",
    name: "Gamma Admin",
    role: UserRole.ADMIN,
    passwordHash,
  });
  await upsertOrgUser({
    organizationId: orgD.id,
    email: "admin@delta.test",
    name: "Delta Admin",
    role: UserRole.ADMIN,
    passwordHash,
  });

  await prisma.platformAdmin.upsert({
    where: { email: "platform@admin.test" },
    update: {
      passwordHash,
      name: "Platform Admin",
      isActive: true,
    },
    create: {
      email: "platform@admin.test",
      passwordHash,
      name: "Platform Admin",
    },
  });

  const vendor = await prisma.vendor.upsert({
    where: { slug: "demo-sms-vendor" },
    update: {
      name: "Demo SMS Vendor",
      referralCode: "DEMOVENDOR",
      onboardingStatus: VendorOnboardingStatus.APPROVED,
      approvedAt: new Date(),
      isActive: true,
    },
    create: {
      name: "Demo SMS Vendor",
      slug: "demo-sms-vendor",
      referralCode: "DEMOVENDOR",
      onboardingStatus: VendorOnboardingStatus.APPROVED,
      approvedAt: new Date(),
    },
  });

  await prisma.vendorUser.upsert({
    where: { email: "vendor@demo.test" },
    update: {
      passwordHash,
      name: "Vendor User",
      isActive: true,
      vendorId: vendor.id,
    },
    create: {
      email: "vendor@demo.test",
      passwordHash,
      name: "Vendor User",
      vendorId: vendor.id,
    },
  });

  const acmeContacts = await Promise.all([
    upsertContact({
      organizationId: orgA.id,
      name: "Priya Sharma",
      mobile: "9800000001",
      birthdayOccasionId: birthdayA.id,
      birthMonth: 7,
      birthDay: 14,
      categoryName: "VIP",
    }),
    upsertContact({
      organizationId: orgA.id,
      name: "Rahul Mehta",
      mobile: "9800000002",
      birthdayOccasionId: birthdayA.id,
      birthMonth: 3,
      birthDay: 21,
      categoryName: "VVIP",
    }),
    upsertContact({
      organizationId: orgA.id,
      name: "Ananya Iyer",
      mobile: "9800000003",
      birthdayOccasionId: birthdayA.id,
      birthMonth: 11,
      birthDay: 5,
      categoryName: "Friend",
    }),
  ]);

  const betaContacts = await Promise.all([
    upsertContact({
      organizationId: orgB.id,
      name: "Jordan Lee",
      mobile: "9811000001",
      birthdayOccasionId: birthdayB.id,
      birthMonth: 1,
      birthDay: 9,
      categoryName: "Relative",
    }),
    upsertContact({
      organizationId: orgB.id,
      name: "Sam Rivera",
      mobile: "9811000002",
      birthdayOccasionId: birthdayB.id,
      birthMonth: 8,
      birthDay: 30,
      categoryName: "VIP",
    }),
  ]);

  const gammaContacts = await Promise.all([
    upsertContact({
      organizationId: orgC.id,
      name: "Neha Kapoor",
      mobile: "9811100001",
      birthdayOccasionId: birthdayC.id,
      birthMonth: 5,
      birthDay: 12,
      categoryName: "VIP",
    }),
    upsertContact({
      organizationId: orgC.id,
      name: "Vikram Singh",
      mobile: "9811100002",
      birthdayOccasionId: birthdayC.id,
      birthMonth: 12,
      birthDay: 1,
      categoryName: "Friend",
    }),
    upsertContact({
      organizationId: orgC.id,
      name: "Meera Joshi",
      mobile: "9811100003",
      birthdayOccasionId: birthdayC.id,
      birthMonth: 2,
      birthDay: 18,
      categoryName: "VVIP",
    }),
    upsertContact({
      organizationId: orgC.id,
      name: "Arjun Nair",
      mobile: "9811100004",
      birthdayOccasionId: birthdayC.id,
      birthMonth: 9,
      birthDay: 7,
      categoryName: "Relative",
    }),
  ]);

  await upsertChannelConfig({
    organizationId: orgA.id,
    channel: Channel.SMS,
    provider: ChannelProvider.TEST,
    vendorId: vendor.id,
  });
  await upsertChannelConfig({
    organizationId: orgA.id,
    channel: Channel.WHATSAPP,
    provider: ChannelProvider.TEST,
    vendorId: vendor.id,
  });
  await upsertChannelConfig({
    organizationId: orgB.id,
    channel: Channel.SMS,
    provider: ChannelProvider.TEST,
    vendorId: vendor.id,
  });
  await upsertChannelConfig({
    organizationId: orgC.id,
    channel: Channel.SMS,
    provider: ChannelProvider.TEST,
    vendorId: vendor.id,
  });
  await upsertChannelConfig({
    organizationId: orgC.id,
    channel: Channel.WHATSAPP,
    provider: ChannelProvider.TEST,
    vendorId: vendor.id,
  });

  const acmeSmsTemplate = await upsertBirthdayTemplate(
    orgA.id,
    Channel.SMS,
    birthdayA.id,
  );
  const acmeWaTemplate = await upsertBirthdayTemplate(
    orgA.id,
    Channel.WHATSAPP,
    birthdayA.id,
  );
  const betaSmsTemplate = await upsertBirthdayTemplate(
    orgB.id,
    Channel.SMS,
    birthdayB.id,
  );
  const gammaSmsTemplate = await upsertBirthdayTemplate(
    orgC.id,
    Channel.SMS,
    birthdayC.id,
  );
  const gammaWaTemplate = await upsertBirthdayTemplate(
    orgC.id,
    Channel.WHATSAPP,
    birthdayC.id,
  );

  await seedCategoryDemoTemplatesAndRoutes({
    organizationId: orgA.id,
    channels: [Channel.SMS, Channel.WHATSAPP],
  });
  await seedCategoryDemoTemplatesAndRoutes({
    organizationId: orgB.id,
    channels: [Channel.SMS],
  });
  await seedCategoryDemoTemplatesAndRoutes({
    organizationId: orgC.id,
    channels: [Channel.SMS, Channel.WHATSAPP],
  });

  const contactByMobile = new Map(
    [...acmeContacts, ...betaContacts, ...gammaContacts].map((c) => [
      c.mobile,
      c,
    ]),
  );

  const birthdayOccasionByOrg = new Map<string, string>([
    [orgA.id, birthdayA.id],
    [orgB.id, birthdayB.id],
    [orgC.id, birthdayC.id],
  ]);

  const seedDeliveries: Array<{
    organizationId: string;
    templateId: string;
    delivery: SeedDelivery;
  }> = [
    {
      organizationId: orgA.id,
      templateId: acmeSmsTemplate.id,
      delivery: {
        key: "seed:acme:sms:delivered:1",
        contactMobile: "9800000001",
        channel: Channel.SMS,
        status: QueueStatus.SENT,
        deliveryStatus: DeliveryStatus.DELIVERED,
        daysAgo: 0,
      },
    },
    {
      organizationId: orgA.id,
      templateId: acmeWaTemplate.id,
      delivery: {
        key: "seed:acme:wa:delivered:1",
        contactMobile: "9800000002",
        channel: Channel.WHATSAPP,
        status: QueueStatus.SENT,
        deliveryStatus: DeliveryStatus.READ,
        daysAgo: 1,
      },
    },
    {
      organizationId: orgA.id,
      templateId: acmeSmsTemplate.id,
      delivery: {
        key: "seed:acme:sms:failed:1",
        contactMobile: "9800000003",
        channel: Channel.SMS,
        status: QueueStatus.FAILED,
        deliveryStatus: DeliveryStatus.FAILED,
        daysAgo: 2,
        errorMessage: "Recipient unreachable",
      },
    },
    {
      organizationId: orgB.id,
      templateId: betaSmsTemplate.id,
      delivery: {
        key: "seed:beta:sms:delivered:1",
        contactMobile: "9811000001",
        channel: Channel.SMS,
        status: QueueStatus.SENT,
        deliveryStatus: DeliveryStatus.DELIVERED,
        daysAgo: 0,
      },
    },
    {
      organizationId: orgB.id,
      templateId: betaSmsTemplate.id,
      delivery: {
        key: "seed:beta:sms:sent:1",
        contactMobile: "9811000002",
        channel: Channel.SMS,
        status: QueueStatus.SENT,
        deliveryStatus: DeliveryStatus.SENT,
        daysAgo: 3,
      },
    },
    {
      organizationId: orgC.id,
      templateId: gammaSmsTemplate.id,
      delivery: {
        key: "seed:gamma:sms:delivered:1",
        contactMobile: "9811100001",
        channel: Channel.SMS,
        status: QueueStatus.SENT,
        deliveryStatus: DeliveryStatus.DELIVERED,
        daysAgo: 0,
      },
    },
    {
      organizationId: orgC.id,
      templateId: gammaWaTemplate.id,
      delivery: {
        key: "seed:gamma:wa:delivered:1",
        contactMobile: "9811100002",
        channel: Channel.WHATSAPP,
        status: QueueStatus.SENT,
        deliveryStatus: DeliveryStatus.DELIVERED,
        daysAgo: 1,
      },
    },
    {
      organizationId: orgC.id,
      templateId: gammaSmsTemplate.id,
      delivery: {
        key: "seed:gamma:sms:undelivered:1",
        contactMobile: "9811100003",
        channel: Channel.SMS,
        status: QueueStatus.FAILED,
        deliveryStatus: DeliveryStatus.UNDELIVERED,
        daysAgo: 4,
        errorMessage: "Invalid destination number",
      },
    },
    {
      organizationId: orgC.id,
      templateId: gammaWaTemplate.id,
      delivery: {
        key: "seed:gamma:wa:queued:1",
        contactMobile: "9811100004",
        channel: Channel.WHATSAPP,
        status: QueueStatus.PENDING,
        deliveryStatus: DeliveryStatus.QUEUED,
        daysAgo: 0,
      },
    },
  ];

  for (const item of seedDeliveries) {
    const contact = contactByMobile.get(item.delivery.contactMobile);
    if (!contact) {
      throw new Error(`Missing seed contact ${item.delivery.contactMobile}`);
    }
    const occasionId = birthdayOccasionByOrg.get(item.organizationId);
    if (!occasionId) {
      throw new Error(`Missing birthday occasion for org ${item.organizationId}`);
    }
    await upsertSeedDelivery({
      organizationId: item.organizationId,
      contactId: contact.id,
      templateId: item.templateId,
      occasionId,
      delivery: item.delivery,
    });
  }

  const demoOtpOrgs: Array<{ id: string; slug: string }> = [
    orgA,
    orgB,
    orgC,
  ];

  const configuredSlug =
    process.env.SMS_CONFIG_ORGANIZATION_SLUG?.trim() || "acme-corp-demo";
  const configuredOrg = await prisma.organization.findUnique({
    where: { slug: configuredSlug },
    select: { id: true, slug: true },
  });
  if (configuredOrg) {
    demoOtpOrgs.push(configuredOrg);
  }

  const uniqueOrgs = [
    ...new Map(demoOtpOrgs.map((org) => [org.id, org])).values(),
  ];

  for (const org of uniqueOrgs) {
    const template = await ensureDemoLiveOtpTemplate(prisma, org.id);
    console.log(
      `- Demo Live OTP template ready on ${org.slug}: ${template.id} (DLT ${template.dltTemplateId})`,
    );
  }

  console.log("Seed complete:");
  console.log(
    `- Organization: ${orgA.name} Owner admin@acme.test / Staff staff@acme.test`,
  );
  console.log(`- Organization: ${orgB.name} Owner admin@beta.test`);
  console.log(`- Organization: ${orgC.name} Owner admin@gamma.test`);
  console.log(`- Organization (inactive): ${orgD.name} Owner admin@delta.test`);
  console.log(
    "- Category demo templates + greeting routes: VVIP/VIP/Relative/Friend × Birthday/Anniversary (Acme, Beta, Gamma)",
  );
  console.log("- Platform Admin: platform@admin.test");
  console.log("- Vendor: vendor@demo.test (demo-sms-vendor, referral DEMOVENDOR)");
  console.log(`Default password for seeded users: ${SEED_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
