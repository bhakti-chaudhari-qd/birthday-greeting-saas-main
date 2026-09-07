import { TemplateValidationError } from "./errors";

export const BUILTIN_TEMPLATE_VARIABLES = ["name", "mobile", "email", "address"] as const;
export const SUPPORTED_TEMPLATE_VARIABLES = BUILTIN_TEMPLATE_VARIABLES;

export const TEMPLATE_PREVIEW_VALUES = {
  name: "Name",
  email: "Email Address",
  mobile: "Phone Number",
  address: "Address",
} as const satisfies Record<SupportedTemplateVariable, string>;

export type SupportedTemplateVariable =
  (typeof SUPPORTED_TEMPLATE_VARIABLES)[number];

export const TEMPLATE_VARIABLE_LABELS = {
  name: "Name",
  mobile: "Phone Number",
  email: "Email Address",
  address: "Address",
} as const satisfies Record<SupportedTemplateVariable, string>;

const VARIABLE_PATTERN = /\{\{(\w+)\}\}/g;
const PLACEHOLDER_PATTERN = /\{\{[^}]*\}\}/g;

function assertValidPlaceholderSyntax(body: string) {
  const placeholders = [...body.matchAll(PLACEHOLDER_PATTERN)];

  for (const match of placeholders) {
    const inner = match[0].slice(2, -2);

    if (!/^\w+$/.test(inner)) {
      throw new TemplateValidationError(
        `Malformed template variable syntax: ${match[0]}`,
      );
    }
  }

  if (body.includes("{{") || body.includes("}}")) {
    const withoutValidPlaceholders = body.replace(VARIABLE_PATTERN, "");

    if (withoutValidPlaceholders.includes("{{") || withoutValidPlaceholders.includes("}}")) {
      throw new TemplateValidationError("Malformed template variable syntax");
    }
  }
}

export function extractTemplateVariables(body: string): string[] {
  const matches = [...body.matchAll(VARIABLE_PATTERN)];
  return [...new Set(matches.map((match) => match[1]))];
}

export function validateTemplateVariables(
  body: string,
  allowedVariables: readonly string[] = SUPPORTED_TEMPLATE_VARIABLES,
): string[] {
  assertValidPlaceholderSyntax(body);
  const variables = extractTemplateVariables(body);
  const unsupported = variables.filter(
    (variable) => !allowedVariables.includes(variable),
  );

  if (unsupported.length > 0) {
    throw new TemplateValidationError(
      `Unsupported template variables: ${unsupported.join(", ")}`,
    );
  }

  return variables;
}

export function renderTemplate(
  body: string,
  values: Partial<Record<string, string | number | boolean | null | undefined>>,
): string {
  return body.replace(VARIABLE_PATTERN, (_match, variable: string) => {
    const value = values[variable];
    return value === null || value === undefined ? "" : String(value).trim();
  });
}

export function previewTemplate(body: string, maxLength = 80): string {
  const compact = body.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) {
    return compact;
  }

  return `${compact.slice(0, maxLength - 1)}…`;
}

export function renderTemplatePreview(body: string): string {
  return renderTemplate(body, TEMPLATE_PREVIEW_VALUES);
}

export function templateValuesForContact(contact: {
  name: string;
  email?: string | null;
  mobile?: string | null;
  address?: string | null;
  attributes?: unknown;
}): Partial<Record<string, string | number | boolean | null | undefined>> {
  const attributes =
    contact.attributes &&
    typeof contact.attributes === "object" &&
    !Array.isArray(contact.attributes)
      ? (contact.attributes as Record<string, string | number | boolean | null | undefined>)
      : {};
  return {
    ...attributes,
    name: contact.name,
    email: contact.email ?? undefined,
    mobile: contact.mobile ?? undefined,
    address: contact.address ?? undefined,
  };
}
