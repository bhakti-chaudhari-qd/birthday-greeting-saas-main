"use client";

import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

// Must be configured in the same module that renders <Document>/<Page> -
// see react-pdf's Next.js App Router guidance (setting it elsewhere can be
// overwritten by module execution order).
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export type PDFViewerProps = {
  fileUrl: string;
  width: number;
  onLoadError?: (message: string) => void;
};

/** Renders page 1 only - multi-page templates are out of scope for now. */
export function PDFViewer({ fileUrl, width, onLoadError }: PDFViewerProps) {
  const [loadError, setLoadError] = useState<string | null>(null);

  return (
    <Document
      file={fileUrl}
      onLoadError={(error) => {
        setLoadError("Could not load this PDF.");
        onLoadError?.(error.message);
      }}
      loading={
        <div
          style={{ width }}
          className="flex h-64 items-center justify-center text-sm text-stone-500"
        >
          Loading PDF...
        </div>
      }
      error={
        <div
          style={{ width }}
          className="flex h-64 items-center justify-center text-sm text-red-600"
        >
          {loadError ?? "Could not load this PDF."}
        </div>
      }
    >
      <Page
        pageNumber={1}
        width={width}
        renderTextLayer={false}
        renderAnnotationLayer={false}
      />
    </Document>
  );
}
