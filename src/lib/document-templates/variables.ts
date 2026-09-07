/**
 * Canonical {{variable}} syntax - the single source of truth reused by the
 * editor's highlight rendering, layout validation, and PDF generation.
 * Simple names only: letters, numbers, underscore.
 */
export const VARIABLE_PATTERN = /\{\{(\w+)\}\}/g;

export type TextSegment =
  | { kind: "text"; value: string }
  | { kind: "variable"; value: string };

export function splitTextIntoVariableSegments(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  const pattern = new RegExp(VARIABLE_PATTERN);
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ kind: "text", value: text.slice(lastIndex, match.index) });
    }
    segments.push({ kind: "variable", value: match[0] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ kind: "text", value: text.slice(lastIndex) });
  }

  return segments;
}

function variableNameFromMatch(matchedText: string): string {
  return matchedText.slice(2, -2);
}

/** Unique variable names referenced in text, in first-seen order. */
export function extractVariableNames(text: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>();

  for (const segment of splitTextIntoVariableSegments(text)) {
    if (segment.kind !== "variable") {
      continue;
    }
    const name = variableNameFromMatch(segment.value);
    if (!seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }

  return names;
}

/**
 * Replaces every {{variable}} with its supplied value. Callers that need to
 * reject missing variables (e.g. PDF generation) must check for them
 * up front with extractVariableNames - unresolved names are dropped here.
 */
export function replaceVariables(
  text: string,
  values: Record<string, string>,
): string {
  return splitTextIntoVariableSegments(text)
    .map((segment) =>
      segment.kind === "variable"
        ? (values[variableNameFromMatch(segment.value)] ?? "")
        : segment.value,
    )
    .join("");
}
