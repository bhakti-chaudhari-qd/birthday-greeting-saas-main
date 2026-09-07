import type { ReactNode } from "react";

import { splitTextIntoVariableSegments, VARIABLE_PATTERN } from "./variables";

// Re-exported under their original names for backward compatibility.
export const VARIABLE_HIGHLIGHT_PATTERN = VARIABLE_PATTERN;
export const splitTextForVariableHighlights = splitTextIntoVariableSegments;

/**
 * Visual-only rendering of text with {{variables}} highlighted. Never used
 * for storage or parsing - the underlying string is untouched.
 */
export function VariableHighlightedText({ text }: { text: string }): ReactNode {
  const segments = splitTextIntoVariableSegments(text);

  return (
    <>
      {segments.map((segment, index) =>
        segment.kind === "variable" ? (
          <mark key={index} className="rounded-[2px] bg-sky-200">
            {segment.value}
          </mark>
        ) : (
          <span key={index}>{segment.value}</span>
        ),
      )}
      {/* Preserves a trailing blank line's height so this stays aligned with the textarea on top. */}
      {text.endsWith("\n") ? "​" : null}
    </>
  );
}
