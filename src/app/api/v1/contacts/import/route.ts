import { ContactImportFileFormat } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  requireSessionAuth,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import { ContactValidationError } from "@/lib/contacts/errors";
import {
  ContactImportJobConflictError,
  enqueueContactImportJob,
} from "@/lib/contacts/import-jobs";
import {
  importContactsFromCsv,
  importContactsFromExcelBase64,
} from "@/lib/contacts/import";
import { SYNC_IMPORT_ROW_THRESHOLD } from "@/lib/contacts/import-constants";
import { scheduleContactImportWorkerProcessing } from "@/lib/contacts/schedule-import-worker";
import { decodeExcelBase64, parseContactExcel } from "@/lib/contacts/excel";
import { parseContactCsv } from "@/lib/contacts/csv";
import { importContactsBodySchema } from "@/lib/validation/contact-csv";

export const dynamic = "force-dynamic";

function countImportRows(input: {
  csv?: string;
  excelBase64?: string;
}): number {
  try {
    if (input.csv?.trim()) {
      return parseContactCsv(input.csv).rows.length;
    }

    if (input.excelBase64?.trim()) {
      const buffer = decodeExcelBase64(input.excelBase64);
      return parseContactExcel(buffer).rows.length;
    }

    return 0;
  } catch (error) {
    throw new ContactValidationError(
      error instanceof Error ? error.message : "Invalid import file",
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSessionAuth();
    const body = await request.json();
    const input = importContactsBodySchema.parse(body);

    const rowCount = countImportRows(input);
    const useSync =
      input.sync === true ||
      (rowCount > 0 && rowCount <= SYNC_IMPORT_ROW_THRESHOLD);

    if (useSync) {
      const summary = input.excelBase64?.trim()
        ? await importContactsFromExcelBase64(
            auth.organizationId,
            input.excelBase64,
            { fieldMappings: input.fieldMappings },
          )
        : await importContactsFromCsv(auth.organizationId, input.csv!, {
            fieldMappings: input.fieldMappings,
          });

      return NextResponse.json({ data: summary, mode: "sync" });
    }

    let fileBytes: Buffer;
    let fileFormat: ContactImportFileFormat;
    let fileName: string;

    if (input.excelBase64?.trim()) {
      fileBytes = Buffer.from(decodeExcelBase64(input.excelBase64));
      fileFormat = ContactImportFileFormat.XLSX;
      fileName = input.fileName?.trim() || "import.xlsx";
    } else {
      fileBytes = Buffer.from(input.csv!, "utf8");
      fileFormat = ContactImportFileFormat.CSV;
      fileName = input.fileName?.trim() || "import.csv";
    }

    const job = await enqueueContactImportJob({
      organizationId: auth.organizationId,
      createdByUserId: auth.userId,
      fileName,
      fileFormat,
      fileBytes,
      fieldMappings: input.fieldMappings,
    });

    scheduleContactImportWorkerProcessing();

    return NextResponse.json({ data: { job }, mode: "async" }, { status: 202 });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof ZodError) {
      return jsonError("Invalid import input", 400, error.flatten());
    }

    if (error instanceof ContactImportJobConflictError) {
      return jsonError(error.message, 409);
    }

    if (error instanceof ContactValidationError) {
      return jsonError(error.message, 400);
    }

    console.error("Import contacts failed", error);
    return jsonError("Failed to import contacts", 500);
  }
}
