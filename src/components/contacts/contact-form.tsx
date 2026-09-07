"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { CreateCategoryModal, type OrgCategory } from "@/components/contacts/create-category-modal";
import { useOccasions } from "@/components/occasions/use-occasions";
import { InlineAlert } from "@/components/ui/feedback";
import {
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui/page";
import { useToast } from "@/components/ui/toast";
import {
  MOBILE_MUST_BE_TEN_DIGITS_MESSAGE,
  normalizeMobile,
  sanitizeMobileInput,
} from "@/lib/contacts/mobile";
import { fetchOrganizationCategories } from "@/lib/client/organization-reference-data";

type ContactFormValues = {
  name: string;
  mobile: string;
  email: string;
  occasionDates: Record<string, string>;
  categoryId: string;
  address: string;
  note: string;
  attributes: Record<string, string>;
  isActive: boolean;
};

type ContactFormProps = {
  mode: "create" | "edit";
  contactId?: string;
  initialValues?: Partial<ContactFormValues>;
};

type AutomationOccasionSummary = {
  occasionId: string;
  occasionName: string;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  emailEnabled: boolean;
  sendTimeLabel: string;
};

type AutomationSummary = {
  anyEnabled: boolean;
  occasions: AutomationOccasionSummary[];
};

const defaultValues: ContactFormValues = {
  name: "",
  mobile: "",
  email: "",
  occasionDates: {},
  categoryId: "",
  address: "",
  note: "",
  attributes: {},
  isActive: true,
};

type ContactFieldDefinition = {
  id: string;
  key: string;
  label: string;
  type: string;
  isActive: boolean;
};

function toLocalMobileDigits(value: string | undefined): string {
  if (!value) {
    return "";
  }

  try {
    return normalizeMobile(value);
  } catch {
    return sanitizeMobileInput(value);
  }
}

function todayInIst() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function monthDay(isoDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  return isoDate.slice(5);
}

/** Fields that only occasionally matter, tucked behind "More Details" so the core flow stays short. */
function hasOptionalValues(values: ContactFormValues): boolean {
  return Boolean(values.note);
}

export function ContactForm({ mode, contactId, initialValues }: ContactFormProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [values, setValues] = useState<ContactFormValues>({
    ...defaultValues,
    ...initialValues,
    mobile: toLocalMobileDigits(initialValues?.mobile ?? defaultValues.mobile),
    email: initialValues?.email ?? defaultValues.email,
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [automation, setAutomation] = useState<AutomationSummary | null>(null);
  const { occasions } = useOccasions();
  const [categories, setCategories] = useState<OrgCategory[]>([]);
  const [fieldDefinitions, setFieldDefinitions] = useState<ContactFieldDefinition[]>([]);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [moreDetailsOpen, setMoreDetailsOpen] = useState(() =>
    hasOptionalValues({ ...defaultValues, ...initialValues } as ContactFormValues),
  );

  useEffect(() => {
    async function loadFormOptions() {
      try {
        const [categories, fieldsResponse] = await Promise.all([
          fetchOrganizationCategories(),
          fetch("/api/v1/contact-fields?isActive=true"),
        ]);
        setCategories(categories);
        const fieldsBody = await fieldsResponse.json();
        if (fieldsResponse.ok) {
          setFieldDefinitions((fieldsBody.data ?? []) as ContactFieldDefinition[]);
        }
      } catch {
        // Optional - form still works without categories or dynamic fields loaded.
      }
    }

    void loadFormOptions();
  }, []);

  useEffect(() => {
    async function loadAutomation() {
      try {
        const response = await fetch("/api/v1/settings/automation-summary");
        const body = await response.json();
        if (response.ok) {
          setAutomation(body.data as AutomationSummary);
        }
      } catch {
        // Warning is optional.
      }
    }

    void loadAutomation();
  }, []);

  const automationWarnings = useMemo(() => {
    if (!automation?.anyEnabled) return [];

    const todayMd = monthDay(todayInIst());
    if (!todayMd) return [];

    const warnings: string[] = [];

    for (const occasion of automation.occasions) {
      const dateValue = values.occasionDates[occasion.occasionId];
      if (!dateValue || monthDay(dateValue) !== todayMd) {
        continue;
      }
      if (!occasion.smsEnabled && !occasion.whatsappEnabled && !occasion.emailEnabled) {
        continue;
      }

      const channelLabels = [
        occasion.smsEnabled ? "SMS" : null,
        occasion.whatsappEnabled ? "WhatsApp" : null,
        occasion.emailEnabled ? "Email" : null,
      ]
        .filter(Boolean)
        .join(" and ");
      warnings.push(
        `${occasion.occasionName} today. Automatic ${channelLabels} greeting may send after ${occasion.sendTimeLabel}.`,
      );
    }

    return warnings;
  }, [automation, values.occasionDates]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    let mobile: string;
    try {
      mobile = normalizeMobile(values.mobile);
    } catch (validationError) {
      setError(
        validationError instanceof Error
          ? validationError.message
          : MOBILE_MUST_BE_TEN_DIGITS_MESSAGE,
      );
      return;
    }

    if (mobile.length !== 10) {
      setError(MOBILE_MUST_BE_TEN_DIGITS_MESSAGE);
      return;
    }

    setIsSubmitting(true);

    const occasionDates: Record<string, string | null> = {};
    for (const [occasionId, value] of Object.entries(values.occasionDates)) {
      occasionDates[occasionId] = value.trim() || null;
    }

    const payload: Record<string, unknown> = {
      name: values.name,
      mobile,
      email: values.email.trim() || null,
      occasionDates,
      categoryId: values.categoryId || null,
      address: values.address.trim() || null,
      note: values.note.trim() || null,
      attributes: Object.fromEntries(
        Object.entries(values.attributes).map(([key, value]) => [key, value.trim()]),
      ),
      isActive: values.isActive,
    };

    try {
      const response = await fetch(
        mode === "create"
          ? "/api/v1/contacts"
          : `/api/v1/contacts/${contactId}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const body = await response.json();

      if (!response.ok) {
        setError(body.error?.message ?? "Failed to save contact");
        return;
      }

      showToast("Contact saved successfully.");

      const savedId = mode === "create" ? (body.data?.id as string | undefined) : undefined;
      router.push(
        savedId
          ? `/dashboard/contacts?highlight=${savedId}`
          : "/dashboard/contacts",
      );
      router.refresh();
    } catch {
      setError("Failed to save contact");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-stone-200/80 bg-white">
      <form onSubmit={handleSubmit}>
        <div className="flex flex-col gap-5 p-6">
          {automationWarnings.map((warning) => (
            <InlineAlert key={warning} tone="warning">
              {warning}{" "}
              <Link
                href="/dashboard"
                className="font-medium text-primary underline"
              >
                Today
              </Link>
            </InlineAlert>
          ))}

          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-stone-900">
              Basic Information
            </h2>

            <label className="block text-sm">
              <span className="font-medium text-stone-800">Name *</span>
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
              <span className="font-medium text-stone-800">Mobile *</span>
              <div className="mt-1 flex overflow-hidden rounded-lg border border-stone-300 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
                <span
                  className="flex shrink-0 items-center border-r border-stone-200 bg-stone-50 px-3 text-sm font-medium text-stone-600"
                  aria-hidden="true"
                >
                  +91
                </span>
                <input
                  className="min-w-0 flex-1 border-0 px-3 py-2 text-sm outline-none"
                  value={values.mobile}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      mobile: sanitizeMobileInput(event.target.value),
                    }))
                  }
                  placeholder="Phone Number"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  pattern="[6-9][0-9]{9}"
                  maxLength={10}
                  minLength={10}
                  title="Enter exactly 10 digits"
                  required
                />
              </div>
              <span className="mt-1 block text-xs text-stone-500">
                10 digits. Country code (+91) is added automatically.
              </span>
            </label>

            <label className="block text-sm">
              <span className="font-medium text-stone-800">Email</span>
              <input
                className={`${inputClass} mt-1`}
                type="email"
                value={values.email}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                placeholder="Needed for email greetings"
                autoComplete="email"
              />
            </label>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {occasions.map((occasion) => (
                <label key={occasion.id} className="block text-sm">
                  <span className="font-medium text-stone-800">
                    {occasion.name}
                  </span>
                  <input
                    className={`${inputClass} mt-1`}
                    type="date"
                    value={values.occasionDates[occasion.id] ?? ""}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        occasionDates: {
                          ...current.occasionDates,
                          [occasion.id]: event.target.value,
                        },
                      }))
                    }
                  />
                </label>
              ))}
            </div>

            <div className="block text-sm">
              <span className="font-medium text-stone-800">Category *</span>
              <div className="mt-1 flex gap-2">
                <select
                  className={inputClass}
                  value={values.categoryId}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      categoryId: event.target.value,
                    }))
                  }
                >
                  <option value="">No category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setCategoryModalOpen(true)}
                  className={`${secondaryButtonClass} shrink-0 whitespace-nowrap`}
                >
                  + New Category
                </button>
              </div>
            </div>
          </div>

          {fieldDefinitions.length > 0 ? (
            <div className="border-t border-stone-200 pt-4">
              <h2 className="text-sm font-semibold text-stone-900">
                Additional Information
              </h2>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {fieldDefinitions.map((field) => (
                  <label key={field.id} className="block text-sm">
                    <span className="font-medium text-stone-800">{field.label}</span>
                    <input
                      className={`${inputClass} mt-1`}
                      value={values.attributes[field.key] ?? ""}
                      onChange={(event) =>
                        setValues((current) => ({
                          ...current,
                          attributes: {
                            ...current.attributes,
                            [field.key]: event.target.value,
                          },
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          <div className="border-t border-stone-200 pt-4">
            <button
              type="button"
              aria-expanded={moreDetailsOpen}
              onClick={() => setMoreDetailsOpen((current) => !current)}
              className="flex w-full items-center justify-between text-left text-sm font-semibold text-stone-900 outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              More Details (Optional)
              <span aria-hidden className="text-xs text-stone-400">
                {moreDetailsOpen ? "▴" : "▾"}
              </span>
            </button>

            {moreDetailsOpen ? (
              <div className="mt-4 flex flex-col gap-4">
                <label className="block text-sm">
                  <span className="font-medium text-stone-800">Notes</span>
                  <textarea
                    className={`${inputClass} mt-1`}
                    rows={2}
                    value={values.note}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        note: event.target.value,
                      }))
                    }
                    placeholder="Optional note about this contact"
                    maxLength={1000}
                  />
                </label>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={values.isActive}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        isActive: event.target.checked,
                      }))
                    }
                  />
                  <span className="font-medium text-stone-800">
                    Active (receives automatic greetings)
                  </span>
                </label>
              </div>
            ) : null}
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>

        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-stone-200 bg-white px-6 py-4">
          <Link href="/dashboard/contacts" className={secondaryButtonClass}>
            Cancel
          </Link>
          <button type="submit" disabled={isSubmitting} className={primaryButtonClass}>
            {isSubmitting ? "Saving…" : "Save Contact"}
          </button>
        </div>
      </form>

      <CreateCategoryModal
        open={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        onCreated={(category) => {
          setCategories((current) => [...current, category].sort((a, b) => a.name.localeCompare(b.name)));
          setValues((current) => ({ ...current, categoryId: category.id }));
          setCategoryModalOpen(false);
        }}
      />
    </div>
  );
}
