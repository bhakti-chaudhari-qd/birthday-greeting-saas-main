import { validateTemplateVariables } from "./variables";

export type TemplateSegment =
  | { type: "static"; value: string }
  | { type: "variable"; name?: string };

const APPLICATION_VARIABLE_PATTERN = /\{\{(\w+)\}\}/g;

/**
 * Approved DLT content may use placeholder syntax that differs from the
 * application template. The legacy HTTP provider sends a fully rendered message
 * body and does not document placeholder syntax in this repository.
 *
 * Structural checks treat these tokens as opaque variable slots only:
 * - application-style {{variable}}
 * - brace/hash {#variable#} (common DLT portal format; not verified in provider code)
 */
const APPROVED_DLT_SLOT_PATTERN = /\{\{[^}]+\}\}|\{#[^#]+#\}/g;

export function parseApplicationTemplateSegments(
  body: string,
): TemplateSegment[] {
  return parseByPattern(body, APPLICATION_VARIABLE_PATTERN, (match) => ({
    type: "variable" as const,
    name: match[1] ?? "",
  }));
}

export function parseApprovedDltSegments(content: string): TemplateSegment[] {
  return parseByPattern(content, APPROVED_DLT_SLOT_PATTERN, () => ({
    type: "variable" as const,
  }));
}

function parseByPattern(
  body: string,
  pattern: RegExp,
  toVariable: (match: RegExpMatchArray) => TemplateSegment,
): TemplateSegment[] {
  const segments: TemplateSegment[] = [];
  let lastIndex = 0;

  for (const match of body.matchAll(pattern)) {
    const index = match.index ?? 0;

    if (index > lastIndex) {
      segments.push({
        type: "static",
        value: body.slice(lastIndex, index),
      });
    }

    segments.push(toVariable(match));
    lastIndex = index + match[0].length;
  }

  if (lastIndex < body.length) {
    segments.push({
      type: "static",
      value: body.slice(lastIndex),
    });
  }

  return segments;
}

export type DltCompatibilityResult = {
  compatible: boolean;
  issues: string[];
};

export function checkDltCompatibility(
  applicationBody: string,
  approvedContent: string,
): DltCompatibilityResult {
  const issues: string[] = [];

  try {
    validateTemplateVariables(applicationBody);
  } catch (error) {
    issues.push(
      error instanceof Error
        ? error.message
        : "Application template has invalid variables",
    );
  }

  if (issues.length > 0) {
    return { compatible: false, issues };
  }

  const applicationSegments = parseApplicationTemplateSegments(applicationBody);
  const approvedSegments = parseApprovedDltSegments(approvedContent);
  const applicationVariableCount = applicationSegments.filter(
    (segment) => segment.type === "variable",
  ).length;
  const approvedVariableCount = approvedSegments.filter(
    (segment) => segment.type === "variable",
  ).length;

  if (applicationVariableCount > 0 && approvedVariableCount === 0) {
    issues.push(
      "Approved DLT content does not contain recognizable variable placeholders for structural verification",
    );
    return { compatible: false, issues };
  }

  if (applicationSegments.length !== approvedSegments.length) {
    issues.push(
      "Application template and approved DLT content have different placeholder structures",
    );
    return { compatible: false, issues };
  }

  for (let index = 0; index < applicationSegments.length; index += 1) {
    const applicationSegment = applicationSegments[index]!;
    const approvedSegment = approvedSegments[index]!;

    if (applicationSegment.type !== approvedSegment.type) {
      issues.push(
        "Application template and approved DLT content have mismatched placeholder positions",
      );
      return { compatible: false, issues };
    }

    if (
      applicationSegment.type === "static" &&
      approvedSegment.type === "static" &&
      applicationSegment.value !== approvedSegment.value
    ) {
      issues.push(
        "Application template and approved DLT content have different static text",
      );
      return { compatible: false, issues };
    }
  }

  return { compatible: true, issues };
}

export function renderApprovedDltContent(
  approvedContent: string,
  variableValuesInOrder: string[],
): string {
  const segments = parseApprovedDltSegments(approvedContent);
  let valueIndex = 0;

  return segments
    .map((segment) => {
      if (segment.type === "static") {
        return segment.value;
      }

      const value = variableValuesInOrder[valueIndex];
      valueIndex += 1;

      if (value === undefined) {
        throw new Error("Missing variable value for approved DLT content slot");
      }

      return value;
    })
    .join("");
}

export function assertRenderedBodyMatchesApprovedStructure(
  applicationBody: string,
  approvedContent: string,
  renderedBody: string,
  variableValues: Record<string, string>,
): DltCompatibilityResult {
  const compatibility = checkDltCompatibility(applicationBody, approvedContent);

  if (!compatibility.compatible) {
    return compatibility;
  }

  const issues: string[] = [];
  const orderedVariables = extractOrderedApplicationVariables(applicationBody);
  const orderedValues = orderedVariables.map(
    (variable) => variableValues[variable]?.trim() ?? "",
  );

  if (orderedValues.some((value) => value.length === 0)) {
    issues.push("Rendered message is missing required personalization values");
    return { compatible: false, issues };
  }

  try {
    const expectedFromApproved = renderApprovedDltContent(
      approvedContent,
      orderedValues,
    );

    if (expectedFromApproved !== renderedBody) {
      issues.push(
        "Rendered message does not match the approved DLT content structure",
      );
    }
  } catch (error) {
    issues.push(
      error instanceof Error
        ? error.message
        : "Failed to validate rendered message against approved DLT content",
    );
  }

  return { compatible: issues.length === 0, issues };
}

function extractOrderedApplicationVariables(body: string): string[] {
  validateTemplateVariables(body);
  return [...body.matchAll(APPLICATION_VARIABLE_PATTERN)].map(
    (match) => match[1] ?? "",
  );
}

// Backward-compatible alias used by older tests/imports.
export const parseTemplateSegments = parseApplicationTemplateSegments;
