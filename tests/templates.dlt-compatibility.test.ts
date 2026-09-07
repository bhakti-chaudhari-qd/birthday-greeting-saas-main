import { describe, expect, it } from "vitest";

import {
  assertRenderedBodyMatchesApprovedStructure,
  checkDltCompatibility,
  renderApprovedDltContent,
} from "@/lib/templates/dlt-compatibility";
import { TemplateValidationError } from "@/lib/templates/errors";
import { validateTemplateVariables } from "@/lib/templates/variables";

describe("DLT compatibility", () => {
  it("accepts exact static content", () => {
    const result = checkDltCompatibility(
      "Hello there!",
      "Hello there!",
    );

    expect(result.compatible).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("accepts one matching application-style placeholder", () => {
    const result = checkDltCompatibility(
      "Happy Birthday {{name}}!",
      "Happy Birthday {{name}}!",
    );

    expect(result.compatible).toBe(true);
  });

  it("accepts approved DLT hash placeholders at the same slot positions", () => {
    const result = checkDltCompatibility(
      "Happy Birthday {{name}}!",
      "Happy Birthday {#name#}!",
    );

    expect(result.compatible).toBe(true);
  });

  it("accepts multiple matching placeholders", () => {
    const result = checkDltCompatibility(
      "Hi {{name}}, happy birthday {{name}}!",
      "Hi {#name#}, happy birthday {#name#}!",
    );

    expect(result.compatible).toBe(true);
  });

  it("rejects static text mismatch", () => {
    const result = checkDltCompatibility(
      "Happy Birthday {{name}}!",
      "Happy Anniversary {#name#}!",
    );

    expect(result.compatible).toBe(false);
    expect(result.issues[0]).toMatch(/static text/i);
  });

  it("rejects extra variable in application body", () => {
    const result = checkDltCompatibility(
      "Hi {{name}} {{name}}!",
      "Hi {#name#}!",
    );

    expect(result.compatible).toBe(false);
  });

  it("rejects missing variable in application body", () => {
    const result = checkDltCompatibility(
      "Hi {{name}}!",
      "Hi {#name#} {#name#}!",
    );

    expect(result.compatible).toBe(false);
  });

  it("rejects reordered variable positions", () => {
    const result = checkDltCompatibility(
      "{{name}} wishes",
      "wishes {#name#}",
    );

    expect(result.compatible).toBe(false);
  });

  it("rejects unsupported application variables", () => {
    expect(() =>
      validateTemplateVariables("Hello {{firstName}}!"),
    ).toThrow(TemplateValidationError);
  });

  it("accepts approved content with no placeholders when application has none", () => {
    const result = checkDltCompatibility(
      "Service notification.",
      "Service notification.",
    );

    expect(result.compatible).toBe(true);
  });

  it("rejects application variable with no approved placeholder", () => {
    const result = checkDltCompatibility(
      "Hello {{name}}!",
      "Hello there!",
    );

    expect(result.compatible).toBe(false);
  });

  it("preserves meaningful whitespace differences", () => {
    const result = checkDltCompatibility(
      "Hello\n{{name}}",
      "Hello {#name#}",
    );

    expect(result.compatible).toBe(false);
  });

  it("rejects approved content with unrecognized placeholder syntax", () => {
    const result = checkDltCompatibility(
      "Hello {{name}}!",
      "Hello %name%!",
    );

    expect(result.compatible).toBe(false);
    expect(result.issues[0]).toMatch(/recognizable variable placeholders/i);
  });
});

describe("rendered message DLT structure checks", () => {
  it("renders approved DLT slots using application variable order", () => {
    expect(
      renderApprovedDltContent("Happy Birthday {#name#}!", ["Alex"]),
    ).toBe("Happy Birthday Alex!");
  });

  it("accepts rendered bodies that match approved DLT structure", () => {
    const result = assertRenderedBodyMatchesApprovedStructure(
      "Happy Birthday {{name}}!",
      "Happy Birthday {#name#}!",
      "Happy Birthday Alex!",
      { name: "Alex" },
    );

    expect(result.compatible).toBe(true);
  });

  it("rejects rendered bodies that diverge from approved static text", () => {
    const result = assertRenderedBodyMatchesApprovedStructure(
      "Happy Birthday {{name}}!",
      "Happy Birthday {#name#}!",
      "Happy Anniversary Alex!",
      { name: "Alex" },
    );

    expect(result.compatible).toBe(false);
  });
});
