"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useOccasions } from "@/components/occasions/use-occasions";
import { InlineAlert } from "@/components/ui/feedback";
import { fetchOrganizationCategories } from "@/lib/client/organization-reference-data";
import { inputClass, primaryButtonClass } from "@/components/ui/page";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { VariablePicker, type TemplateVariableOption } from "@/components/templates/variable-picker";
import {
  WHATSAPP_MEDIA_CONTENT_TYPES,
  WHATSAPP_MEDIA_MAX_BYTES,
} from "@/lib/channel-config/whatsapp-types";
import { WHATSAPP_TEMPLATE_LANGUAGES } from "@/lib/templates/whatsapp-metadata";
import {
  TEMPLATE_PREVIEW_VALUES,
} from "@/lib/templates/variables";

const WHATSAPP_LANGUAGE_OPTIONS = WHATSAPP_TEMPLATE_LANGUAGES.map((language) => ({
  value: language.code,
  label: language.name,
  secondary: language.code,
}));

export type TemplateFormChannel = "SMS" | "WHATSAPP" | "EMAIL";
type WhatsAppMediaKind = "IMAGE" | "VIDEO";

type TemplateFormValues = {
  name: string;
  occasionId: string;
  categoryId: string;
  isActive: boolean;
  body: string;
  emailSubject: string;
  whatsappTemplateName: string;
  whatsappProviderTemplateId: string;
  whatsappLanguage: string;
  whatsappMediaAssetId: string | null;
  whatsappMediaKind: WhatsAppMediaKind | null;
  whatsappMediaPreviewUrl: string | null;
  dltTemplateId: string;
  dltApprovedContent: string;
  includePersonalizedPdf: boolean;
  documentTemplateId: string | null;
};

type DocumentTemplateOption = {
  id: string;
  name: string;
  occasionName: string | null;
};

type TemplateFormProps = {
  mode: "create" | "edit";
  channel: TemplateFormChannel;
  templateId?: string;
  initialValues?: Partial<TemplateFormValues>;
};

const defaultValues: TemplateFormValues = {
  name: "",
  occasionId: "",
  categoryId: "",
  isActive: true,
  body: "",
  emailSubject: "",
  whatsappTemplateName: "",
  whatsappProviderTemplateId: "",
  whatsappLanguage: "en",
  whatsappMediaAssetId: null,
  whatsappMediaKind: null,
  whatsappMediaPreviewUrl: null,
  dltTemplateId: "",
  dltApprovedContent: "",
  includePersonalizedPdf: false,
  documentTemplateId: null,
};

/** Approved DLT content may use {{var}} or {#var#} placeholder syntax; both map to the app's {{name}} slot. */
const APPROVED_DLT_SLOT_PATTERN = /\{\{[^}]+\}\}|\{#[^#]+#\}/g;

function deriveSmsBodyFromDlt(approvedContent: string) {
  return approvedContent.trim().replace(APPROVED_DLT_SLOT_PATTERN, "{{name}}");
}

function channelLabel(channel: TemplateFormChannel) {
  if (channel === "WHATSAPP") return "WhatsApp";
  if (channel === "EMAIL") return "Email";
  return "SMS";
}

export type ApiErrorBody = {
  error?: {
    message?: string;
    details?: {
      fieldErrors?: Record<string, string[] | undefined>;
      formErrors?: string[];
    };
  };
};

/**
 * Save routes only ever return a generic top-level message (e.g. "Invalid
 * template input") - the actually-useful reason lives in Zod's flatten()
 * output under error.details. Surfacing the first specific issue means a
 * validation failure is never a dead end with no way to tell what's wrong.
 */
export function describeSaveError(body: ApiErrorBody, fallback: string): string {
  const message = body.error?.message ?? fallback;
  const details = body.error?.details;
  // Include the Zod issue's own field path (not a manually-guessed name) so
  // "Expected string, received null" is traceable to the exact field.
  const firstFieldEntry = details?.fieldErrors
    ? Object.entries(details.fieldErrors).find(
        (entry): entry is [string, string[]] =>
          Boolean(entry[1] && entry[1].length > 0),
      )
    : undefined;

  if (firstFieldEntry) {
    const [field, issues] = firstFieldEntry;
    return `${message}: ${field} — ${issues[0]}`;
  }

  const formError = details?.formErrors?.[0];
  return formError && formError !== message ? `${message}: ${formError}` : message;
}

const ALLOWED_MEDIA_CONTENT_TYPES: readonly string[] = WHATSAPP_MEDIA_CONTENT_TYPES;

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Failed to read file"));
        return;
      }
      const commaIndex = result.indexOf(",");
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

export function TemplateForm({
  mode,
  channel,
  templateId,
  initialValues,
}: TemplateFormProps) {
  const router = useRouter();
  const { occasions } = useOccasions();
  const [values, setValues] = useState<TemplateFormValues>({
    ...defaultValues,
    ...initialValues,
  });
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>(
    [],
  );
  const [customVariables, setCustomVariables] = useState<TemplateVariableOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmDltPairReviewed, setConfirmDltPairReviewed] = useState(false);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [documentTemplates, setDocumentTemplates] = useState<DocumentTemplateOption[]>(
    [],
  );

  useEffect(() => {
    let cancelled = false;
    async function loadCategories() {
      try {
        const [categories, fieldsResponse] = await Promise.all([
          fetchOrganizationCategories(),
          fetch("/api/v1/contact-fields?isActive=true"),
        ]);
        if (!cancelled) {
          setCategories(
            categories.map((item) => ({
            id: item.id,
            name: item.name,
            })),
          );
        }
        const fieldsBody = await fieldsResponse.json();
        if (fieldsResponse.ok && !cancelled) {
          setCustomVariables(
            (fieldsBody.data as Array<{ key: string; label: string }>).map((field) => ({
              key: field.key,
              label: field.label,
            })),
          );
        }
      } catch {
        // Form still works with All groups only.
      }
    }
    void loadCategories();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadDocumentTemplates() {
      try {
        const response = await fetch(
          "/api/v1/document-templates?isActive=true&limit=100",
        );
        const body = await response.json();
        if (response.ok && !cancelled) {
          setDocumentTemplates(
            (
              body.data as Array<{
                id: string;
                name: string;
                occasionName: string | null;
              }>
            ).map((item) => ({
              id: item.id,
              name: item.name,
              occasionName: item.occasionName,
            })),
          );
        }
      } catch {
        // The personalized-PDF option still works with an empty selector.
      }
    }
    void loadDocumentTemplates();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function selectDefaultOccasion() {
      setValues((current) => {
        if (
          current.occasionId &&
          occasions.some((occasion) => occasion.id === current.occasionId)
        ) {
          return current;
        }
        return { ...current, occasionId: occasions[0]?.id ?? "" };
      });
    }
    if (occasions.length > 0) {
      selectDefaultOccasion();
    }
  }, [occasions]);

  const baselineDltTemplateId = initialValues?.dltTemplateId?.trim() ?? "";
  const baselineDltApprovedContent =
    initialValues?.dltApprovedContent?.trim() ?? "";
  const dltPairChanged =
    baselineDltTemplateId !== values.dltTemplateId.trim() ||
    baselineDltApprovedContent !== values.dltApprovedContent.trim();
  const needsDltAcknowledgement =
    Boolean(baselineDltTemplateId || baselineDltApprovedContent) && dltPairChanged;

  const previewBody = useMemo(() => {
    const source =
      channel === "SMS" ? deriveSmsBodyFromDlt(values.dltApprovedContent) : values.body;
    const customPreviewValues = new Map(
      customVariables.map((field) => [field.key, field.label]),
    );
    return source.replace(/\{\{(\w+)\}\}/g, (match, variable: string) => {
      return (
        TEMPLATE_PREVIEW_VALUES[variable as keyof typeof TEMPLATE_PREVIEW_VALUES] ??
        customPreviewValues.get(variable) ??
        match
      );
    });
  }, [channel, customVariables, values.dltApprovedContent, values.body]);

  function insertVariable(
    field: "body" | "emailSubject",
    variable: string,
  ) {
    setValues((current) => ({
      ...current,
      [field]: `${current[field]}{{${variable}}}`,
    }));
  }

  function handleVariableSelect(field: "body" | "emailSubject", value: string) {
    if (!value) return;
    insertVariable(field, value);
  }

  async function handleMediaSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    setMediaError(null);

    if (!ALLOWED_MEDIA_CONTENT_TYPES.includes(file.type)) {
      setMediaError("Media must be a JPEG image or an MP4/WebM video.");
      return;
    }
    if (file.size > WHATSAPP_MEDIA_MAX_BYTES) {
      setMediaError(
        `Media must be at most ${Math.floor(WHATSAPP_MEDIA_MAX_BYTES / 1_000_000)} MB.`,
      );
      return;
    }

    setMediaUploading(true);
    try {
      const mediaBase64 = await readFileAsBase64(file);
      const response = await fetch("/api/v1/whatsapp-media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaBase64, filename: file.name }),
      });
      const body = await response.json();

      if (!response.ok) {
        setMediaError(body.error?.message ?? "Failed to upload media");
        return;
      }

      const contentType = body.data.contentType as string;
      setValues((current) => ({
        ...current,
        whatsappMediaAssetId: body.data.id as string,
        whatsappMediaKind: contentType.startsWith("video/") ? "VIDEO" : "IMAGE",
        whatsappMediaPreviewUrl: body.data.previewUrl as string,
      }));
    } catch {
      setMediaError("Failed to upload media");
    } finally {
      setMediaUploading(false);
    }
  }

  function handleRemoveMedia() {
    setValues((current) => ({
      ...current,
      whatsappMediaAssetId: null,
      whatsappMediaKind: null,
      whatsappMediaPreviewUrl: null,
    }));
  }

  function handleTogglePersonalizedPdf(checked: boolean) {
    setValues((current) => ({
      ...current,
      includePersonalizedPdf: checked,
      // Clearing on uncheck keeps the UI and the saved state in sync -
      // re-enabling always requires an explicit selection.
      documentTemplateId: checked ? current.documentTemplateId : null,
    }));
  }

  async function submitStandard() {
    const payload: Record<string, unknown> = {
      name: values.name,
      occasionId: values.occasionId,
      channel,
      categoryId: values.categoryId || null,
      isActive: values.isActive,
      body: values.body,
      includePersonalizedPdf: values.includePersonalizedPdf,
      documentTemplateId: values.includePersonalizedPdf
        ? values.documentTemplateId
        : null,
    };

    if (channel === "WHATSAPP") {
      // The provider-facing template name is a distinct, exact-match value
      // (letters/numbers/underscores only, e.g. "birthday") - it must never
      // be silently derived from the free-text display Name above, which
      // has no such format constraint.
      payload.whatsappTemplateName = values.whatsappTemplateName.trim();
      payload.whatsappProviderTemplateId =
        values.whatsappProviderTemplateId.trim() || undefined;
      payload.whatsappLanguage = values.whatsappLanguage;
      // createTemplateSchema's whatsappMediaAssetId is a plain optional
      // string (no media to clear yet, so null isn't a valid state) -
      // updateTemplateSchema accepts null too, since editing uses it to
      // explicitly clear a previously-attached media asset. Only normalize
      // on create; an edit's explicit null-to-clear must still go through.
      payload.whatsappMediaAssetId =
        mode === "create"
          ? (values.whatsappMediaAssetId ?? undefined)
          : values.whatsappMediaAssetId;
    }

    if (channel === "EMAIL") {
      payload.emailSubject = values.emailSubject;
    }

    const response = await fetch(
      mode === "create" ? "/api/v1/templates" : `/api/v1/templates/${templateId}`,
      {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const body = await response.json();

    if (!response.ok) {
      throw new Error(describeSaveError(body, "Failed to save template"));
    }
  }

  async function submitSms() {
    const derivedBody = deriveSmsBodyFromDlt(values.dltApprovedContent);
    let currentTemplateId = templateId;

    if (mode === "create") {
      const createResponse = await fetch("/api/v1/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          occasionId: values.occasionId,
          channel: "SMS",
          body: derivedBody,
          categoryId: values.categoryId || null,
          isActive: values.isActive,
          includePersonalizedPdf: values.includePersonalizedPdf,
          documentTemplateId: values.includePersonalizedPdf
            ? values.documentTemplateId
            : null,
          replaceExisting: true,
        }),
      });
      const createBody = await createResponse.json();
      if (!createResponse.ok) {
        throw new Error(describeSaveError(createBody, "Failed to save template"));
      }
      currentTemplateId = createBody.data.id as string;
    } else if (currentTemplateId) {
      const patchResponse = await fetch(`/api/v1/templates/${currentTemplateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          occasionId: values.occasionId,
          categoryId: values.categoryId || null,
          isActive: values.isActive,
          body: derivedBody,
          includePersonalizedPdf: values.includePersonalizedPdf,
          documentTemplateId: values.includePersonalizedPdf
            ? values.documentTemplateId
            : null,
        }),
      });
      const patchBody = await patchResponse.json();
      if (!patchResponse.ok) {
        throw new Error(describeSaveError(patchBody, "Failed to save template"));
      }
    }

    if (!currentTemplateId) {
      throw new Error("Failed to save template");
    }

    const setupPayload: Record<string, unknown> = {
      dltTemplateId: values.dltTemplateId.trim(),
      dltApprovedContent: values.dltApprovedContent.trim(),
    };
    if (needsDltAcknowledgement) {
      setupPayload.confirmDltPairReviewed = confirmDltPairReviewed;
    }

    const setupResponse = await fetch(
      `/api/v1/templates/${currentTemplateId}/sms-setup`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(setupPayload),
      },
    );
    const setupBody = await setupResponse.json();
    if (!setupResponse.ok) {
      throw new Error(
        setupBody.error?.message ?? "Failed to save approved DLT details",
      );
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (channel === "SMS") {
        await submitSms();
      } else {
        await submitStandard();
      }
      router.push("/dashboard/templates");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to save template",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const submitDisabled =
    isSubmitting ||
    mediaUploading ||
    (needsDltAcknowledgement && !confirmDltPairReviewed);

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <label className="block text-sm">
        <span className="font-medium text-stone-800">Template Name</span>
        <input
          className={`${inputClass} mt-1`}
          value={values.name}
          onChange={(event) =>
            setValues((current) => ({ ...current, name: event.target.value }))
          }
          required
        />
      </label>

      <label className="block text-sm">
        <span className="font-medium text-stone-800">Occasion</span>
        <select
          className={`${inputClass} mt-1`}
          value={values.occasionId}
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              occasionId: event.target.value,
            }))
          }
        >
          {occasions.map((occasion) => (
            <option key={occasion.id} value={occasion.id}>
              {occasion.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="font-medium text-stone-800">Group</span>
        <select
          className={`${inputClass} mt-1`}
          value={values.categoryId}
          onChange={(event) =>
            setValues((current) => ({ ...current, categoryId: event.target.value }))
          }
        >
          <option value="">All groups</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-stone-500">
          Used by automations and manual sends for the selected group, plus
          All-groups templates.
        </p>
      </label>

      {channel === "EMAIL" ? (
        <label className="block text-sm">
          <span className="font-medium text-stone-800">Subject</span>
          <input
            className={`${inputClass} mt-1`}
            value={values.emailSubject}
            onChange={(event) =>
              setValues((current) => ({ ...current, emailSubject: event.target.value }))
            }
            placeholder="Happy Birthday {{name}}!"
            required
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <VariablePicker
              customVariables={customVariables}
              onSelect={(variable) => handleVariableSelect("emailSubject", variable)}
            />
          </div>
        </label>
      ) : null}

      {channel === "WHATSAPP" ? (
        <>
          <label className="block text-sm">
            <span className="font-medium text-stone-800">
              Approved WhatsApp Template Name
            </span>
            <input
              className={`${inputClass} mt-1`}
              value={values.whatsappTemplateName}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  whatsappTemplateName: event.target.value,
                }))
              }
              placeholder="birthday"
              pattern="[A-Za-z0-9_]+"
              title="Letters, numbers, and underscores only"
              required
            />
            <span className="mt-1 block text-xs text-stone-500">
              The exact name registered with your WhatsApp provider (letters,
              numbers, and underscores only) - this is separate from the
              &quot;Template Name&quot; field above, which is only this
              app&apos;s internal label for the template.
            </span>
          </label>

          <label className="block text-sm">
            <span className="font-medium text-stone-800">Template ID</span>
            <input
              className={`${inputClass} mt-1`}
              value={values.whatsappProviderTemplateId}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  whatsappProviderTemplateId: event.target.value,
                }))
              }
              placeholder="2107282356442541"
            />
          </label>

          <label className="block text-sm">
            <span className="font-medium text-stone-800">Language</span>
            <div className="mt-1">
              <SearchableSelect
                options={WHATSAPP_LANGUAGE_OPTIONS}
                value={values.whatsappLanguage}
                onChange={(whatsappLanguage) =>
                  setValues((current) => ({ ...current, whatsappLanguage }))
                }
                placeholder="Search language..."
                emptyMessage="No matching language"
                aria-label="Language"
                required
              />
            </div>
          </label>
        </>
      ) : null}

      {channel === "SMS" ? (
        <>
          <label className="block text-sm">
            <span className="font-medium text-stone-800">DLT Template ID</span>
            <input
              className={`${inputClass} mt-1`}
              value={values.dltTemplateId}
              onChange={(event) =>
                setValues((current) => ({ ...current, dltTemplateId: event.target.value }))
              }
              required
            />
          </label>

          <label className="block text-sm">
            <span className="font-medium text-stone-800">Approved DLT Content</span>
            <textarea
              className={`${inputClass} mt-1 min-h-32`}
              value={values.dltApprovedContent}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  dltApprovedContent: event.target.value,
                }))
              }
              placeholder="Happy Birthday {#var#}! Wishing you a wonderful year ahead."
              required
            />
          </label>
        </>
      ) : (
        <label className="block text-sm">
          <span className="font-medium text-stone-800">
            {channel === "WHATSAPP" ? "Approved Text" : "Email Body"}
          </span>
          <textarea
            className={`${inputClass} mt-1 min-h-32`}
            value={values.body}
            onChange={(event) =>
              setValues((current) => ({ ...current, body: event.target.value }))
            }
            placeholder="Happy Birthday {{name}}! Wishing you a wonderful year ahead."
            required
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <VariablePicker
              customVariables={customVariables}
              onSelect={(variable) => handleVariableSelect("body", variable)}
            />
          </div>
        </label>
      )}

      {channel === "WHATSAPP" ? (
        <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
          <p className="text-sm font-medium text-stone-800">Attachment (optional)</p>
          {values.whatsappMediaAssetId && values.whatsappMediaPreviewUrl ? (
            <div className="mt-2 flex items-center justify-between gap-3 text-sm">
              <a
                href={values.whatsappMediaPreviewUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                {values.whatsappMediaKind === "VIDEO" ? "Video" : "Image"} attached ·
                View
              </a>
              <button
                type="button"
                className="shrink-0 text-xs font-medium text-stone-500 outline-none hover:text-stone-800 hover:underline"
                onClick={handleRemoveMedia}
              >
                Remove
              </button>
            </div>
          ) : (
            <p className="mt-1 text-sm text-stone-500">No media attached.</p>
          )}
          <div className="mt-2">
            <input
              type="file"
              accept="image/jpeg,video/mp4,video/webm"
              onChange={(event) => void handleMediaSelected(event)}
              disabled={mediaUploading}
              className="text-sm text-stone-700"
            />
            {mediaUploading ? (
              <p className="mt-1 text-xs text-stone-500">Uploading…</p>
            ) : null}
          </div>
          {mediaError ? (
            <div className="mt-2">
              <InlineAlert tone="error">{mediaError}</InlineAlert>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
        <p className="text-sm font-medium text-stone-800">Personalized Document</p>
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={values.includePersonalizedPdf}
            onChange={(event) => handleTogglePersonalizedPdf(event.target.checked)}
          />
          <span>Include personalized PDF</span>
        </label>

        {values.includePersonalizedPdf ? (
          <label className="mt-3 block text-sm">
            <span className="font-medium text-stone-800">PDF Template</span>
            <select
              className={`${inputClass} mt-1`}
              value={values.documentTemplateId ?? ""}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  documentTemplateId: event.target.value || null,
                }))
              }
              required
            >
              <option value="">Select a document template</option>
              {documentTemplates.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.occasionName
                    ? `${option.name} (${option.occasionName})`
                    : option.name}
                </option>
              ))}
            </select>
            {documentTemplates.length === 0 ? (
              <p className="mt-1 text-xs text-stone-500">
                No document templates yet. Create one under Document Templates
                first.
              </p>
            ) : null}
          </label>
        ) : null}
      </div>

      <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm text-stone-600">
        <p className="font-medium text-stone-800">Preview</p>
        <p className="mt-1 whitespace-pre-wrap text-stone-900">
          {previewBody || "Enter content above to preview personalization."}
        </p>
      </div>

      {mode === "edit" ? (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={values.isActive}
            onChange={(event) =>
              setValues((current) => ({ ...current, isActive: event.target.checked }))
            }
          />
          <span className="font-medium text-stone-800">Active</span>
        </label>
      ) : null}

      {needsDltAcknowledgement ? (
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={confirmDltPairReviewed}
            onChange={(event) => setConfirmDltPairReviewed(event.target.checked)}
          />
          <span>
            I have reviewed the DLT Template ID and approved content pair. I
            understand this is not proof of DLT approval.
          </span>
        </label>
      ) : null}

      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}

      <button type="submit" disabled={submitDisabled} className={primaryButtonClass}>
        {isSubmitting
          ? "Saving…"
          : mode === "create"
            ? `Add ${channelLabel(channel)} Template`
            : "Save changes"}
      </button>
    </form>
  );
}
