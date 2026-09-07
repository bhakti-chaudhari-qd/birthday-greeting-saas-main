import { describe, expect, it } from "vitest";

import {
  extractTemplateVariables,
  renderTemplate,
  validateTemplateVariables,
} from "@/lib/templates/variables";
import { TemplateValidationError } from "@/lib/templates/errors";
import {
  createTemplateSchema,
  listTemplatesQuerySchema,
  updateTemplateSchema,
} from "@/lib/validation/template";

const TEST_OCCASION_ID = "cltest00000000000000000001";
const LEGACY_OCCASION_ID = "47c7f87f3a8df2798ba0ca7c6f9b50a1";

describe("template validation", () => {
  it("accepts replaceExisting on create schema", () => {
    const parsed = createTemplateSchema.safeParse({
      name: "Birthday SMS",
      occasionId: TEST_OCCASION_ID,
      channel: "SMS",
      body: "Happy Birthday {{name}}!",
      replaceExisting: true,
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.replaceExisting).toBe(true);
    }
  });

  it("accepts valid template creation input", () => {
    const parsed = createTemplateSchema.safeParse({
      name: "Birthday SMS",
      occasionId: TEST_OCCASION_ID,
      channel: "SMS",
      body: "Happy Birthday {{name}}!",
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects empty name", () => {
    const parsed = createTemplateSchema.safeParse({
      name: "   ",
      occasionId: TEST_OCCASION_ID,
      channel: "SMS",
      body: "Happy Birthday {{name}}!",
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects empty content", () => {
    const parsed = createTemplateSchema.safeParse({
      name: "Birthday SMS",
      occasionId: TEST_OCCASION_ID,
      channel: "SMS",
      body: "   ",
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects empty occasionId", () => {
    const parsed = createTemplateSchema.safeParse({
      name: "Birthday SMS",
      occasionId: "",
      channel: "SMS",
      body: "Happy Birthday {{name}}!",
    });

    expect(parsed.success).toBe(false);
  });

  it("accepts migrated occasion ids in template list filters", () => {
    const parsed = listTemplatesQuerySchema.safeParse({
      occasionId: LEGACY_OCCASION_ID,
      channel: "SMS",
      isActive: "true",
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects invalid channel", () => {
    const parsed = createTemplateSchema.safeParse({
      name: "Birthday SMS",
      occasionId: TEST_OCCASION_ID,
      channel: "FAX",
      body: "Happy Birthday {{name}}!",
    });

    expect(parsed.success).toBe(false);
  });

  it("accepts email templates with subject", () => {
    const parsed = createTemplateSchema.safeParse({
      name: "Birthday Email",
      occasionId: TEST_OCCASION_ID,
      channel: "EMAIL",
      emailSubject: "Happy Birthday {{name}}!",
      body: "Wishing you a wonderful day, {{name}}!",
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects email templates without subject", () => {
    const parsed = createTemplateSchema.safeParse({
      name: "Birthday Email",
      occasionId: TEST_OCCASION_ID,
      channel: "EMAIL",
      body: "Happy Birthday {{name}}!",
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects unknown variables", () => {
    expect(() =>
      validateTemplateVariables("Hello {{firstName}}"),
    ).toThrow(TemplateValidationError);
  });

  it("accepts {{name}}", () => {
    expect(validateTemplateVariables("Happy Birthday {{name}}!")).toEqual([
      "name",
    ]);
  });

  it("rejects organizationId in create schema", () => {
    const parsed = createTemplateSchema.safeParse({
      name: "Birthday SMS",
      occasionId: TEST_OCCASION_ID,
      channel: "SMS",
      body: "Happy Birthday {{name}}!",
      organizationId: "other-org",
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects organizationId in update schema", () => {
    const parsed = updateTemplateSchema.safeParse({
      organizationId: "other-org",
      body: "Updated {{name}}",
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects DLT fields in create schema", () => {
    const parsed = createTemplateSchema.safeParse({
      name: "Birthday SMS",
      occasionId: TEST_OCCASION_ID,
      channel: "SMS",
      body: "Happy Birthday {{name}}!",
      dltTemplateId: "DLT123456",
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects readiness overrides in update schema", () => {
    const parsed = updateTemplateSchema.safeParse({
      realSmsReady: true,
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects whatsappMediaAssetId: null on create (no media to clear yet, so null isn't valid input)", () => {
    const parsed = createTemplateSchema.safeParse({
      name: "birthday",
      occasionId: TEST_OCCASION_ID,
      channel: "WHATSAPP",
      body: "Happy Birthday {{name}}!",
      whatsappTemplateName: "birthday",
      whatsappLanguage: "en",
      whatsappMediaAssetId: null,
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const issue = parsed.error.issues.find(
        (i) => i.path.join(".") === "whatsappMediaAssetId",
      );
      expect(issue?.message).toBe("Expected string, received null");
    }
  });

  it("accepts an omitted whatsappMediaAssetId on create (the field's actual optional shape)", () => {
    const parsed = createTemplateSchema.safeParse({
      name: "birthday",
      occasionId: TEST_OCCASION_ID,
      channel: "WHATSAPP",
      body: "Happy Birthday {{name}}!",
      whatsappTemplateName: "birthday",
      whatsappLanguage: "en",
      whatsappMediaAssetId: undefined,
    });

    expect(parsed.success).toBe(true);
  });

  it("accepts whatsappMediaAssetId: null on update (used to explicitly clear a previously-attached media asset)", () => {
    const parsed = updateTemplateSchema.safeParse({
      whatsappMediaAssetId: null,
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects malformed variable syntax", () => {
    expect(() => validateTemplateVariables("Hello {{ name }}!")).toThrow(
      TemplateValidationError,
    );
    expect(() => validateTemplateVariables("Hello {{name")).toThrow(
      TemplateValidationError,
    );
  });
});

describe("template rendering", () => {
  it("renders supported contact variables correctly", () => {
    expect(
      renderTemplate("Hi {{name}} at {{email}} / {{mobile}} / {{address}}", {
        name: "Hrishi",
        email: "hrishi@example.test",
        mobile: "9999999999",
        address: "Main Road",
      }),
    ).toBe("Hi Hrishi at hrishi@example.test / 9999999999 / Main Road");
  });

  it("renders multiple occurrences correctly", () => {
    expect(
      renderTemplate("Hi {{name}}, happy birthday {{name}}!", {
        name: "Hrishi",
      }),
    ).toBe("Hi Hrishi, happy birthday Hrishi!");
  });

  it("renders missing values as empty strings", () => {
    expect(renderTemplate("Happy Birthday {{name}}!", {})).toBe(
      "Happy Birthday !",
    );
  });

  it("trims empty values when rendering", () => {
    expect(renderTemplate("Happy Birthday {{name}}!", { name: "   " })).toBe(
      "Happy Birthday !",
    );
  });

  it("detects variables used in content", () => {
    expect(
      extractTemplateVariables("Hello {{name}}, from {{name}}"),
    ).toEqual(["name"]);
  });
});
