"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";

import { InlineAlert } from "@/components/ui/feedback";
import { PageShell, Panel } from "@/components/ui/page";
import { extractVariableNames } from "@/lib/document-templates/variables";

import { EditorToolbar } from "./editor-toolbar";
import { GeneratePanel } from "./generate-panel";
import { OverlayLayer } from "./overlay-layer";
import type { LayoutTextElement } from "./text-box";
import { TypographyPanel } from "./typography-panel";
import { VariablePanel } from "./variable-panel";

const PDFViewer = dynamic(
  () => import("./pdf-viewer").then((mod) => mod.PDFViewer),
  { ssr: false },
);

const DEFAULT_RENDER_WIDTH = 700;

function createTextElement(): LayoutTextElement {
  return {
    id: crypto.randomUUID(),
    type: "text",
    x: 0.5,
    y: 0.5,
    width: 0.2,
    text: "New Text",
    fontSize: 16,
    color: "#000000",
    fontWeight: "normal",
    fontStyle: "normal",
    textDecoration: "none",
    textAlign: "left",
  };
}

/**
 * Pure by-id patch merge, factored out of handleElementChange so the "only
 * the matching element changes" guarantee is unit-testable without
 * rendering the editor.
 */
export function patchElementById<T extends { id: string }>(
  items: T[],
  id: string,
  patch: Partial<T>,
): T[] {
  return items.map((item) => (item.id === id ? { ...item, ...patch } : item));
}

export function DocumentEditorPageClient({
  templateId,
}: {
  templateId: string;
}) {
  const [templateName, setTemplateName] = useState("");
  const [elements, setElements] = useState<LayoutTextElement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renderWidth, setRenderWidth] = useState(DEFAULT_RENDER_WIDTH);
  const [activeElementId, setActiveElementId] = useState<string | null>(null);
  const [generateValues, setGenerateValues] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateSuccess, setGenerateSuccess] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const textareaRefsRef = useRef(new Map<string, HTMLTextAreaElement>());

  const requiredVariableNames = useMemo(
    () => [
      ...new Set(elements.flatMap((element) => extractVariableNames(element.text))),
    ],
    [elements],
  );

  const activeElement =
    elements.find((element) => element.id === activeElementId) ?? null;

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [templateResponse, layoutResponse] = await Promise.all([
          fetch(`/api/v1/document-templates/${templateId}`),
          fetch(`/api/v1/document-templates/${templateId}/layout`),
        ]);
        const templateBody = await templateResponse.json();
        const layoutBody = await layoutResponse.json();

        if (!templateResponse.ok) {
          setError(
            templateBody.error?.message ?? "Could not load document template.",
          );
          return;
        }
        setTemplateName(templateBody.data.name);

        if (layoutResponse.ok) {
          setElements(layoutBody.data.layoutJson?.elements ?? []);
        }
      } catch {
        setError("Could not load the editor. Check your connection and try again.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [templateId]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) {
        setRenderWidth(Math.min(DEFAULT_RENDER_WIDTH, Math.max(320, width)));
      }
    });
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  function handleElementChange(
    elementId: string,
    patch: Partial<LayoutTextElement>,
  ) {
    setSaved(false);
    setElements((current) => patchElementById(current, elementId, patch));
  }

  function handleDelete(elementId: string) {
    setSaved(false);
    setElements((current) => current.filter((element) => element.id !== elementId));
  }

  function handleAddText() {
    setSaved(false);
    setElements((current) => [...current, createTextElement()]);
  }

  function registerTextarea(elementId: string, node: HTMLTextAreaElement | null) {
    if (node) {
      textareaRefsRef.current.set(elementId, node);
    } else {
      textareaRefsRef.current.delete(elementId);
    }
  }

  function handleInsertVariable(variableName: string) {
    if (!activeElementId) {
      return;
    }
    const textarea = textareaRefsRef.current.get(activeElementId);
    const element = elements.find((item) => item.id === activeElementId);
    if (!textarea || !element) {
      return;
    }

    const start = textarea.selectionStart ?? element.text.length;
    const end = textarea.selectionEnd ?? element.text.length;
    const insertion = `{{${variableName}}}`;
    const nextText = element.text.slice(0, start) + insertion + element.text.slice(end);
    const nextCursor = start + insertion.length;

    handleElementChange(activeElementId, { text: nextText });

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/v1/document-templates/${templateId}/layout`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ layoutJson: { elements } }),
        },
      );
      const body = await response.json();
      if (!response.ok) {
        setError(body.error?.message ?? "Could not save layout.");
        return;
      }
      setSaved(true);
    } catch {
      setError("Could not save layout. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleGenerateValueChange(name: string, value: string) {
    setGenerateValues((current) => ({ ...current, [name]: value }));
  }

  async function handleGenerate() {
    setGenerating(true);
    setGenerateError(null);
    setGenerateSuccess(false);
    try {
      const response = await fetch("/api/v1/generated-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, data: generateValues }),
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        setGenerateError(body.error?.message ?? "Could not generate PDF.");
        return;
      }

      // Navigate an off-DOM link at the authenticated file route so the
      // browser's normal download flow handles it (cookies, save dialog) -
      // no need to fetch the bytes into this page just to redirect them.
      const link = document.createElement("a");
      link.href = `${body.data.fileUrl}?download=1`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setGenerateSuccess(true);
    } catch {
      setGenerateError(
        "Could not generate PDF. Check your connection and try again.",
      );
    } finally {
      setGenerating(false);
    }
  }

  return (
    <PageShell wide>
      <EditorToolbar
        templateName={templateName || "Document Template"}
        saving={saving}
        saved={saved}
        onAddText={handleAddText}
        onSave={() => void handleSave()}
      />

      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}

      <TypographyPanel
        element={activeElement}
        onChange={(patch) => {
          if (activeElementId) {
            handleElementChange(activeElementId, patch);
          }
        }}
      />

      <VariablePanel
        disabled={!activeElementId}
        onInsert={handleInsertVariable}
      />

      <Panel className="overflow-auto p-6">
        {loading ? (
          <p className="text-sm text-stone-600">Loading editor...</p>
        ) : (
          <div ref={wrapperRef} className="w-full">
            <div ref={containerRef} className="relative inline-block">
              <PDFViewer
                fileUrl={`/api/v1/document-templates/${templateId}/file`}
                width={renderWidth}
                onLoadError={(message) => setError(message)}
              />
              <OverlayLayer
                containerRef={containerRef}
                elements={elements}
                onElementChange={handleElementChange}
                onDelete={handleDelete}
                onFocusElement={setActiveElementId}
                onRegisterTextarea={registerTextarea}
              />
            </div>
          </div>
        )}
      </Panel>

      <GeneratePanel
        variableNames={requiredVariableNames}
        values={generateValues}
        onValueChange={handleGenerateValueChange}
        onGenerate={() => void handleGenerate()}
        generating={generating}
        error={generateError}
        success={generateSuccess}
      />
    </PageShell>
  );
}
