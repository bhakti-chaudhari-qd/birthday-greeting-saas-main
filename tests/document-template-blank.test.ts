import { PageSizes, PDFDocument } from "pdf-lib";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));

vi.mock("@/lib/db", () => ({
  prisma: { documentTemplate: { create: createMock } },
}));

import {
  buildBlankTemplatePdf,
  createBlankDocumentTemplate,
} from "@/lib/document-templates/service";
import { createBlankDocumentTemplateSchema } from "@/lib/validation/document-template";

async function pageSize(bytes: Uint8Array) {
  const pdf = await PDFDocument.load(bytes);
  expect(pdf.getPageCount()).toBe(1);
  const { width, height } = pdf.getPage(0).getSize();
  return [width, height];
}

describe("buildBlankTemplatePdf", () => {
  it.each([
    ["A4", "portrait", PageSizes.A4],
    ["A4", "landscape", [PageSizes.A4[1], PageSizes.A4[0]]],
    ["LETTER", "portrait", PageSizes.Letter],
    ["LETTER", "landscape", [PageSizes.Letter[1], PageSizes.Letter[0]]],
  ] as const)("builds a single %s %s page", async (size, orientation, expected) => {
    const bytes = await buildBlankTemplatePdf(size, orientation);
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect(await pageSize(bytes)).toEqual(expected);
  });
});

describe("createBlankDocumentTemplateSchema", () => {
  it("defaults to A4 portrait", () => {
    expect(createBlankDocumentTemplateSchema.parse({ name: "Card" })).toEqual({
      name: "Card",
      pageSize: "A4",
      orientation: "portrait",
    });
  });

  it("rejects unknown sizes, orientations and fields", () => {
    expect(() =>
      createBlankDocumentTemplateSchema.parse({ name: "Card", pageSize: "A3" }),
    ).toThrow();
    expect(() =>
      createBlankDocumentTemplateSchema.parse({ name: "Card", orientation: "up" }),
    ).toThrow();
    expect(() =>
      createBlankDocumentTemplateSchema.parse({ name: "Card", extra: 1 }),
    ).toThrow();
    expect(() => createBlankDocumentTemplateSchema.parse({ name: " " })).toThrow();
  });
});

describe("createBlankDocumentTemplate", () => {
  beforeEach(() => {
    createMock.mockReset();
    createMock.mockImplementation(({ data }) => Promise.resolve(data));
  });

  it("stores a blank PDF named after the template", async () => {
    await createBlankDocumentTemplate("org-1", "user-1", {
      name: "  Diwali / Card ",
      pageSize: "LETTER",
      orientation: "landscape",
    });

    const data = createMock.mock.calls[0][0].data;
    expect(data.name).toBe("Diwali / Card");
    expect(data.fileName).toBe("Diwali - Card.pdf");
    expect(data.contentType).toBe("application/pdf");
    expect(data.occasionId).toBeNull();
    expect(data.byteLength).toBe(data.bytes.length);
    expect(await pageSize(data.bytes)).toEqual([
      PageSizes.Letter[1],
      PageSizes.Letter[0],
    ]);
  });
});
