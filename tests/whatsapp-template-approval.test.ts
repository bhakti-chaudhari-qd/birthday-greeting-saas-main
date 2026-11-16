import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findConfig: vi.fn(),
  findTemplate: vi.fn(),
  updateTemplate: vi.fn(),
  graph: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    channelConfig: { findUnique: mocks.findConfig },
    messageTemplate: { findFirst: mocks.findTemplate, update: mocks.updateTemplate },
  },
}));

vi.mock("@/lib/crypto/credentials", () => ({
  decryptCredentials: (value: string) => value,
}));

vi.mock("@/lib/messaging/meta-graph", async () => {
  const actual = await vi.importActual<typeof import("@/lib/messaging/meta-graph")>(
    "@/lib/messaging/meta-graph",
  );
  return { ...actual, metaGraphRequest: mocks.graph };
});

import { MetaGraphError } from "@/lib/messaging/meta-graph";
import {
  WhatsAppApprovalError,
  refreshWhatsAppApproval,
  submitWhatsAppTemplateForApproval,
  toMetaTemplateBody,
  toMetaTemplateName,
} from "@/lib/templates/whatsapp-approval";
import { whatsappChannelConfigWriteSchema } from "@/lib/validation/whatsapp-channel-config";

describe("toMetaTemplateBody", () => {
  it("numbers placeholders in order and records which value fills each", () => {
    expect(
      toMetaTemplateBody("Happy birthday, {{name}}! We will call you on {{mobile}} today."),
    ).toEqual({
      text: "Happy birthday, {{1}}! We will call you on {{2}} today.",
      parameterOrder: ["name", "mobile"],
      examples: ["Asha", "9876543210"],
    });
  });

  it("uses a generic example for custom contact fields", () => {
    expect(toMetaTemplateBody("Hi {{name}}, your {{plan}} renews soon.").examples).toEqual([
      "Asha",
      "Sample",
    ]);
  });

  it("allows text with no placeholders", () => {
    expect(toMetaTemplateBody("Happy birthday from all of us!")).toEqual({
      text: "Happy birthday from all of us!",
      parameterOrder: [],
      examples: [],
    });
  });

  it.each([
    ["starts with a placeholder", "{{name}}, happy birthday!"],
    ["ends with a placeholder", "Happy birthday {{name}}"],
    ["has two placeholders side by side", "Hello {{name}} {{mobile}} and welcome"],
    ["repeats a placeholder", "Hi {{name}}, yes you {{name}}, happy birthday!"],
    ["is empty", "   "],
    ["is too long", `Hello ${"x".repeat(1100)}`],
  ])("rejects text that %s", (_label, body) => {
    expect(() => toMetaTemplateBody(body)).toThrow(WhatsAppApprovalError);
  });
});

describe("toMetaTemplateName", () => {
  it("lowercases valid names and rejects invalid ones", () => {
    expect(toMetaTemplateName("Birthday_Wish_2")).toBe("birthday_wish_2");
    expect(() => toMetaTemplateName("birthday wish")).toThrow(WhatsAppApprovalError);
    expect(() => toMetaTemplateName("")).toThrow(WhatsAppApprovalError);
  });
});

describe("WhatsApp channel settings: business account ID", () => {
  const base = { provider: "META", phoneNumberId: "1284784621387108" } as const;

  it("accepts digits or an empty value (to clear it)", () => {
    expect(
      whatsappChannelConfigWriteSchema.safeParse({ ...base, businessAccountId: "1198772719741001" })
        .success,
    ).toBe(true);
    expect(
      whatsappChannelConfigWriteSchema.safeParse({ ...base, businessAccountId: "" }).success,
    ).toBe(true);
  });

  it("rejects anything that is not an ID", () => {
    expect(
      whatsappChannelConfigWriteSchema.safeParse({ ...base, businessAccountId: "waba-123" })
        .success,
    ).toBe(false);
  });
});

function metaConfig(settings: Record<string, unknown>) {
  return {
    provider: "META",
    encryptedCredentials: JSON.stringify({ accessToken: "token" }),
    settings: { phoneNumberId: "1284784621387108", ...settings },
  };
}

function whatsappTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: "tpl1",
    organizationId: "org1",
    channel: "WHATSAPP",
    body: "Happy birthday, {{name}}! Have a great year.",
    whatsappTemplateName: "Birthday_Wish",
    whatsappLanguage: "en",
    whatsappProviderTemplateId: null,
    whatsappMediaAssetId: null,
    whatsappApprovalStatus: null,
    whatsappApprovalCategory: null,
    whatsappRejectedReason: null,
    whatsappSubmittedAt: null,
    whatsappStatusCheckedAt: null,
    ...overrides,
  };
}

describe("submitWhatsAppTemplateForApproval", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findTemplate.mockResolvedValue(whatsappTemplate());
    mocks.findConfig.mockResolvedValue(metaConfig({ businessAccountId: "1198772719741001" }));
    mocks.updateTemplate.mockImplementation(async ({ data }) => ({
      ...whatsappTemplate(),
      ...data,
    }));
  });

  it("creates the template in Meta and saves the result", async () => {
    mocks.graph.mockResolvedValue({ id: "999", status: "PENDING", category: "MARKETING" });

    const view = await submitWhatsAppTemplateForApproval("org1", "tpl1", "MARKETING");

    expect(mocks.graph).toHaveBeenCalledWith(
      "https://graph.facebook.com/v21.0/1198772719741001/message_templates",
      "token",
      {
        method: "POST",
        body: {
          name: "birthday_wish",
          language: "en",
          category: "MARKETING",
          components: [
            {
              type: "BODY",
              text: "Happy birthday, {{1}}! Have a great year.",
              example: { body_text: [["Asha"]] },
            },
          ],
        },
      },
    );
    expect(mocks.updateTemplate.mock.calls[0]![0].data).toMatchObject({
      whatsappTemplateName: "birthday_wish",
      whatsappProviderTemplateId: "999",
      whatsappParameterOrder: ["name"],
      whatsappApprovalStatus: "PENDING",
      whatsappApprovalCategory: "MARKETING",
    });
    expect(view.status).toBe("PENDING");
  });

  it("edits a rejected template in place instead of creating a new one", async () => {
    mocks.findTemplate.mockResolvedValue(
      whatsappTemplate({ whatsappProviderTemplateId: "999", whatsappApprovalStatus: "REJECTED" }),
    );
    mocks.graph.mockResolvedValue({ success: true });

    await submitWhatsAppTemplateForApproval("org1", "tpl1", "MARKETING");

    expect(mocks.graph.mock.calls[0]![0]).toBe("https://graph.facebook.com/v21.0/999");
    expect(mocks.updateTemplate.mock.calls[0]![0].data).toMatchObject({
      whatsappProviderTemplateId: "999",
      whatsappApprovalStatus: "PENDING",
      whatsappRejectedReason: null,
    });
  });

  it("needs the client's own Meta connection", async () => {
    mocks.findConfig.mockResolvedValue({ ...metaConfig({}), provider: "CUSTOM_HTTP" });
    await expect(
      submitWhatsAppTemplateForApproval("org1", "tpl1", "MARKETING"),
    ).rejects.toMatchObject({ code: "NOT_META" });
    expect(mocks.graph).not.toHaveBeenCalled();
  });

  it("needs the WhatsApp Business Account ID", async () => {
    mocks.findConfig.mockResolvedValue(metaConfig({}));
    await expect(
      submitWhatsAppTemplateForApproval("org1", "tpl1", "MARKETING"),
    ).rejects.toMatchObject({ code: "NO_BUSINESS_ACCOUNT" });
  });

  it("does not submit templates with an image or video yet", async () => {
    mocks.findTemplate.mockResolvedValue(whatsappTemplate({ whatsappMediaAssetId: "media1" }));
    await expect(
      submitWhatsAppTemplateForApproval("org1", "tpl1", "MARKETING"),
    ).rejects.toMatchObject({ code: "MEDIA_NOT_SUPPORTED" });
  });

  it("passes Meta's own error message through and saves nothing", async () => {
    mocks.graph.mockRejectedValue(
      new MetaGraphError("Template name already exists in this language"),
    );
    await expect(
      submitWhatsAppTemplateForApproval("org1", "tpl1", "MARKETING"),
    ).rejects.toMatchObject({
      code: "META",
      message: "Template name already exists in this language",
    });
    expect(mocks.updateTemplate).not.toHaveBeenCalled();
  });
});

describe("refreshWhatsAppApproval", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findConfig.mockResolvedValue(metaConfig({ businessAccountId: "1198772719741001" }));
    mocks.updateTemplate.mockImplementation(async ({ data }) => ({
      ...whatsappTemplate(),
      ...data,
    }));
  });

  it("reads the status by Meta template ID and saves the rejection reason", async () => {
    mocks.findTemplate.mockResolvedValue(whatsappTemplate({ whatsappProviderTemplateId: "999" }));
    mocks.graph.mockResolvedValue({
      id: "999",
      status: "REJECTED",
      category: "MARKETING",
      rejected_reason: "INVALID_FORMAT",
    });

    const view = await refreshWhatsAppApproval("org1", "tpl1");

    expect(mocks.graph.mock.calls[0]![0]).toContain("/999?fields=");
    expect(view).toMatchObject({ status: "REJECTED", rejectedReason: "INVALID_FORMAT" });
  });

  it("finds a template created in WhatsApp Manager by exact name and language", async () => {
    mocks.findTemplate.mockResolvedValue(whatsappTemplate({ whatsappTemplateName: "birthday" }));
    mocks.graph.mockResolvedValue({
      data: [
        { id: "1", name: "birthday_v2", language: "en", status: "PENDING" },
        { id: "2", name: "birthday", language: "en", status: "APPROVED", rejected_reason: "NONE" },
      ],
    });

    const view = await refreshWhatsAppApproval("org1", "tpl1");

    expect(view).toMatchObject({ status: "APPROVED", rejectedReason: null });
    expect(mocks.updateTemplate.mock.calls[0]![0].data).toMatchObject({
      whatsappProviderTemplateId: "2",
    });
  });
});
