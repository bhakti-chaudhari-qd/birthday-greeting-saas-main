import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { DocumentTemplateValidationError } from "./errors";

const PDF_MAGIC_BYTES = Buffer.from("%PDF-", "utf8");
// .docx is a ZIP container; legacy .doc is an OLE2 compound file.
const ZIP_MAGIC_BYTES = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const OLE_MAGIC_BYTES = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

const CONVERSION_TIMEOUT_MS = 60_000;

export type DocumentTemplateSourceKind = "pdf" | "docx" | "doc";

function startsWith(bytes: Buffer, magic: Buffer): boolean {
  return bytes.length >= magic.length && bytes.subarray(0, magic.length).equals(magic);
}

/**
 * Identifies the upload by its content, using the extension only to tell a
 * .docx apart from other ZIP files. Browsers often send an empty or
 * octet-stream MIME type for Word files, so contentType isn't trusted here.
 */
export function detectDocumentTemplateSourceKind(
  bytes: Buffer,
  filename: string,
): DocumentTemplateSourceKind | null {
  const extension = path.extname(filename).toLowerCase();
  if (startsWith(bytes, PDF_MAGIC_BYTES)) {
    return "pdf";
  }
  if (extension === ".docx" && startsWith(bytes, ZIP_MAGIC_BYTES)) {
    return "docx";
  }
  if (extension === ".doc" && startsWith(bytes, OLE_MAGIC_BYTES)) {
    return "doc";
  }
  return null;
}

function sofficeBinary(): string {
  return process.env.SOFFICE_PATH?.trim() || "soffice";
}

function runSoffice(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    // Ignore for tracing: the binary is a system install, not a project file.
    execFile(
      /*turbopackIgnore: true*/ sofficeBinary(),
      args,
      { timeout: CONVERSION_TIMEOUT_MS, windowsHide: true },
      (error) => (error ? reject(error) : resolve()),
    );
  });
}

/** Converts a Word document to PDF with headless LibreOffice. */
export async function convertWordToPdf(
  bytes: Buffer,
  kind: Exclude<DocumentTemplateSourceKind, "pdf">,
): Promise<Buffer> {
  const workDir = await mkdtemp(path.join(tmpdir(), "doc-template-"));
  try {
    const inputPath = path.join(workDir, `input.${kind}`);
    await writeFile(inputPath, bytes);

    // A per-run profile dir lets concurrent conversions run side by side
    // (LibreOffice locks its profile) and works for users without a HOME.
    const profileUrl = pathToFileURL(path.join(workDir, "profile")).href;
    try {
      await runSoffice([
        `-env:UserInstallation=${profileUrl}`,
        "--headless",
        "--norestore",
        "--convert-to",
        "pdf",
        "--outdir",
        workDir,
        inputPath,
      ]);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        console.error(
          "LibreOffice (soffice) not found; set SOFFICE_PATH or install it",
        );
      } else {
        console.error("Word to PDF conversion failed", error);
      }
      throw new DocumentTemplateValidationError(
        "Could not convert the Word document to PDF",
      );
    }

    const pdf = await readFile(path.join(workDir, "input.pdf")).catch(() => null);
    if (!pdf || !startsWith(pdf, PDF_MAGIC_BYTES)) {
      throw new DocumentTemplateValidationError(
        "Could not convert the Word document to PDF",
      );
    }
    return pdf;
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
