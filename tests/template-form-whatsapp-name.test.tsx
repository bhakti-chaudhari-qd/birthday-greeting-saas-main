import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

import {
  TemplateForm,
  describeSaveError,
  type ApiErrorBody,
} from "@/components/templates/template-form";

describe("describeSaveError", () => {
  it("falls back to the provided default when the body has no message", () => {
    expect(describeSaveError({}, "Failed to save template")).toBe(
      "Failed to save template",
    );
  });

  it("returns the top-level message when there is no field-level detail", () => {
    const body: ApiErrorBody = {
      error: { message: "WhatsApp provider template name is required" },
    };
    expect(describeSaveError(body, "Failed to save template")).toBe(
      "WhatsApp provider template name is required",
    );
  });

  it("appends the field path and the first field-level Zod validation reason to the generic message", () => {
    // Exactly the shape the templates API route returns for a ZodError:
    // jsonError("Invalid template input", 400, error.flatten()).
    const body: ApiErrorBody = {
      error: {
        message: "Invalid template input",
        details: {
          fieldErrors: {
            whatsappTemplateName: [
              "WhatsApp provider template name may only contain letters, numbers, and underscores",
            ],
          },
        },
      },
    };

    expect(describeSaveError(body, "Failed to save template")).toBe(
      "Invalid template input: whatsappTemplateName — WhatsApp provider template name may only contain letters, numbers, and underscores",
    );
  });

  it("reports the exact Zod field path for a type-mismatch error, not a guessed name", () => {
    const body: ApiErrorBody = {
      error: {
        message: "Invalid template input",
        details: {
          fieldErrors: {
            whatsappMediaAssetId: ["Expected string, received null"],
          },
        },
      },
    };

    expect(describeSaveError(body, "Failed to save template")).toBe(
      "Invalid template input: whatsappMediaAssetId — Expected string, received null",
    );
  });

  it("falls back to a formError when there are no fieldErrors", () => {
    const body: ApiErrorBody = {
      error: {
        message: "Invalid template input",
        details: { formErrors: ["Unrecognized key(s) in object"] },
      },
    };

    expect(describeSaveError(body, "Failed to save template")).toBe(
      "Invalid template input: Unrecognized key(s) in object",
    );
  });

  it("does not duplicate the message when the detail is identical to it", () => {
    const body: ApiErrorBody = {
      error: {
        message: "Same text",
        details: { formErrors: ["Same text"] },
      },
    };

    expect(describeSaveError(body, "Failed to save template")).toBe(
      "Same text",
    );
  });

  it("skips empty fieldErrors arrays and finds the first non-empty one", () => {
    const body: ApiErrorBody = {
      error: {
        message: "Invalid template input",
        details: {
          fieldErrors: {
            emailSubject: [],
            whatsappLanguage: ["WhatsApp language is required"],
          },
        },
      },
    };

    expect(describeSaveError(body, "Failed to save template")).toBe(
      "Invalid template input: whatsappLanguage — WhatsApp language is required",
    );
  });
});

describe("TemplateForm WhatsApp fields", () => {
  it("renders a dedicated Approved WhatsApp Template Name field, separate from the internal Template Name", () => {
    const html = renderToStaticMarkup(
      <TemplateForm mode="create" channel="WHATSAPP" />,
    );

    expect(html).toContain("Approved WhatsApp Template Name");
    // The generic internal "Template Name" field still exists too - both
    // must be present, and they must be genuinely distinct labels.
    expect(html).toContain(">Template Name<");
  });

  it("does not render WhatsApp-specific fields for other channels", () => {
    const smsHtml = renderToStaticMarkup(
      <TemplateForm mode="create" channel="SMS" />,
    );
    const emailHtml = renderToStaticMarkup(
      <TemplateForm mode="create" channel="EMAIL" />,
    );

    expect(smsHtml).not.toContain("Approved WhatsApp Template Name");
    expect(emailHtml).not.toContain("Approved WhatsApp Template Name");
  });

  it("loads the saved WhatsApp Template Name (not the display name) when editing", () => {
    const html = renderToStaticMarkup(
      <TemplateForm
        mode="edit"
        channel="WHATSAPP"
        templateId="tpl-1"
        initialValues={{
          name: "Birthday Greeting",
          whatsappTemplateName: "birthday",
          whatsappLanguage: "en",
        }}
      />,
    );

    // The provider-facing field shows the exact approved name "birthday",
    // not the free-text display name "Birthday Greeting".
    expect(html).toContain('value="birthday"');
  });
});
