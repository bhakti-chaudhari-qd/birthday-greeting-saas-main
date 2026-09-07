import { describe, expect, it } from "vitest";

import { splitTextForVariableHighlights } from "@/lib/document-templates/variable-highlight";

describe("splitTextForVariableHighlights", () => {
  it("returns a single text segment when there are no variables", () => {
    expect(splitTextForVariableHighlights("Happy Birthday")).toEqual([
      { kind: "text", value: "Happy Birthday" },
    ]);
  });

  it("splits out a single variable", () => {
    expect(splitTextForVariableHighlights("Happy Birthday {{name}}")).toEqual([
      { kind: "text", value: "Happy Birthday " },
      { kind: "variable", value: "{{name}}" },
    ]);
  });

  it("handles multiple variables with text between and around them", () => {
    expect(
      splitTextForVariableHighlights("Dear {{name}}, see you at {{address}}!"),
    ).toEqual([
      { kind: "text", value: "Dear " },
      { kind: "variable", value: "{{name}}" },
      { kind: "text", value: ", see you at " },
      { kind: "variable", value: "{{address}}" },
      { kind: "text", value: "!" },
    ]);
  });

  it("treats a bare {{ }} with no simple name as plain text, not a variable", () => {
    expect(splitTextForVariableHighlights("{{ }} and {{}}")).toEqual([
      { kind: "text", value: "{{ }} and {{}}" },
    ]);
  });

  it("does not treat names with spaces or punctuation as variables", () => {
    expect(splitTextForVariableHighlights("{{first name}}")).toEqual([
      { kind: "text", value: "{{first name}}" },
    ]);
  });

  it("allows letters, numbers, and underscores in variable names", () => {
    expect(splitTextForVariableHighlights("{{contact_2}}")).toEqual([
      { kind: "variable", value: "{{contact_2}}" },
    ]);
  });

  it("returns an empty array for empty text", () => {
    expect(splitTextForVariableHighlights("")).toEqual([]);
  });

  it("is stable across repeated calls (no shared regex lastIndex state)", () => {
    const first = splitTextForVariableHighlights("{{name}}");
    const second = splitTextForVariableHighlights("{{name}}");
    expect(first).toEqual(second);
  });
});
