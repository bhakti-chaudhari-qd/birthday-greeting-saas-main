import { beforeEach, describe, expect, it, vi } from "vitest";

const { execFileMock, createMock } = vi.hoisted(() => ({
  execFileMock: vi.fn(),
  createMock: vi.fn(),
}));

vi.mock("node:child_process", () => ({ execFile: execFileMock }));
vi.mock("@/lib/db", () => ({
  prisma: { documentTemplate: { create: createMock } },
}));

import { writeFile } from "node:fs/promises";
import path from "node:path";

import { DocumentTemplateValidationError } from "@/lib/document-templates/errors";
import { createDocumentTemplate } from "@/lib/document-templates/service";
import { detectDocumentTemplateSourceKind } from "@/lib/document-templates/word-to-pdf";

const PDF_BYTES = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");
const DOCX_BYTES = Buffer.concat([
  Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  Buffer.from("word/document.xml"),
]);
const DOC_BYTES = Buffer.concat([
  Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
  Buffer.alloc(16),
]);

/** Fakes soffice by writing a PDF next to the input, as LibreOffice does. */
function fakeSofficeSuccess() {
  execFileMock.mockImplementation(
    (_bin: string, args: string[], _opts: unknown, callback: (e: Error | null) => void) => {
      const outDir = args[args.indexOf("--outdir") + 1];
      writeFile(path.join(outDir, "input.pdf"), PDF_BYTES).then(
        () => callback(null),
        callback,
      );
    },
  );
}

function upload(bytes: Buffer, filename: string, contentType = "") {
  return createDocumentTemplate("org-1", "user-1", {
    name: "Card",
    file: { bytes, filename, contentType },
  });
}

describe("detectDocumentTemplateSourceKind", () => {
  it("detects by content, using the extension only for Word containers", () => {
    expect(detectDocumentTemplateSourceKind(PDF_BYTES, "a.pdf")).toBe("pdf");
    expect(detectDocumentTemplateSourceKind(DOCX_BYTES, "a.DOCX")).toBe("docx");
    expect(detectDocumentTemplateSourceKind(DOC_BYTES, "a.doc")).toBe("doc");
  });

  it("rejects renamed or unsupported files", () => {
    expect(detectDocumentTemplateSourceKind(DOCX_BYTES, "a.zip")).toBeNull();
    expect(detectDocumentTemplateSourceKind(Buffer.from("hello"), "a.docx")).toBeNull();
    expect(detectDocumentTemplateSourceKind(Buffer.from("hello"), "a.pdf")).toBeNull();
  });
});

describe("createDocumentTemplate with Word uploads", () => {
  beforeEach(() => {
    execFileMock.mockReset();
    createMock.mockReset();
    createMock.mockImplementation(({ data }) => Promise.resolve(data));
  });

  it("stores PDFs as-is without running LibreOffice", async () => {
    await upload(PDF_BYTES, "card.pdf", "application/pdf");

    expect(execFileMock).not.toHaveBeenCalled();
    const data = createMock.mock.calls[0][0].data;
    expect(data.fileName).toBe("card.pdf");
    expect(Buffer.from(data.bytes).equals(PDF_BYTES)).toBe(true);
  });

  it.each([
    ["card.docx", DOCX_BYTES],
    ["card.doc", DOC_BYTES],
  ])("converts %s to a stored PDF", async (filename, bytes) => {
    fakeSofficeSuccess();

    await upload(bytes, filename);

    const args = execFileMock.mock.calls[0][1] as string[];
    expect(args).toEqual(expect.arrayContaining(["--headless", "--convert-to", "pdf"]));
    const data = createMock.mock.calls[0][0].data;
    expect(data.fileName).toBe("card.pdf");
    expect(data.contentType).toBe("application/pdf");
    expect(Buffer.from(data.bytes).equals(PDF_BYTES)).toBe(true);
    expect(data.byteLength).toBe(PDF_BYTES.length);
  });

  it("returns a validation error when conversion fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    execFileMock.mockImplementation(
      (_bin: string, _args: string[], _opts: unknown, callback: (e: Error) => void) =>
        callback(Object.assign(new Error("spawn soffice ENOENT"), { code: "ENOENT" })),
    );

    await expect(upload(DOCX_BYTES, "card.docx")).rejects.toThrow(
      DocumentTemplateValidationError,
    );
    expect(createMock).not.toHaveBeenCalled();
  });

  it("rejects unsupported file types", async () => {
    await expect(upload(Buffer.from("hello"), "notes.txt")).rejects.toThrow(
      "Only PDF or Word (.doc, .docx) files are allowed",
    );
    expect(execFileMock).not.toHaveBeenCalled();
  });
});
