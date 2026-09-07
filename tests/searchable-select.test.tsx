import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  SearchableSelect,
  filterSearchableOptions,
  type SearchableSelectOption,
} from "@/components/ui/searchable-select";

const LANGUAGE_OPTIONS: SearchableSelectOption[] = [
  { value: "en", label: "English", secondary: "en" },
  { value: "hi", label: "Hindi", secondary: "hi" },
  { value: "mr", label: "Marathi", secondary: "mr" },
  { value: "gu", label: "Gujarati", secondary: "gu" },
];

describe("filterSearchableOptions", () => {
  it("returns every option for an empty query", () => {
    expect(filterSearchableOptions(LANGUAGE_OPTIONS, "")).toEqual(LANGUAGE_OPTIONS);
    expect(filterSearchableOptions(LANGUAGE_OPTIONS, "   ")).toEqual(LANGUAGE_OPTIONS);
  });

  it("finds a language by its full name", () => {
    const result = filterSearchableOptions(LANGUAGE_OPTIONS, "Marathi");
    expect(result.map((option) => option.value)).toEqual(["mr"]);
  });

  it("finds a language by a partial name", () => {
    const result = filterSearchableOptions(LANGUAGE_OPTIONS, "mar");
    expect(result.map((option) => option.value)).toEqual(["mr"]);
  });

  it("finds a language by its exact code", () => {
    const result = filterSearchableOptions(LANGUAGE_OPTIONS, "mr");
    expect(result.map((option) => option.value)).toEqual(["mr"]);
  });

  it("finds English by a partial name", () => {
    const result = filterSearchableOptions(LANGUAGE_OPTIONS, "eng");
    expect(result.map((option) => option.value)).toEqual(["en"]);
  });

  it("is case-insensitive for both name and code searches", () => {
    expect(filterSearchableOptions(LANGUAGE_OPTIONS, "MARATHI").map((o) => o.value)).toEqual([
      "mr",
    ]);
    expect(filterSearchableOptions(LANGUAGE_OPTIONS, "MR").map((o) => o.value)).toEqual(["mr"]);
  });

  it("returns no options for a query that matches nothing", () => {
    expect(filterSearchableOptions(LANGUAGE_OPTIONS, "xyz-not-a-language")).toEqual([]);
  });
});

describe("SearchableSelect rendering", () => {
  it("renders the resolved label and code for the current value when closed", () => {
    const html = renderToStaticMarkup(
      <SearchableSelect options={LANGUAGE_OPTIONS} value="mr" onChange={() => {}} />,
    );

    expect(html).toContain("Marathi — mr");
  });

  it("falls back to the raw stored code if it isn't in the option list (existing/legacy values still show something, never silently blank)", () => {
    const html = renderToStaticMarkup(
      <SearchableSelect options={LANGUAGE_OPTIONS} value="xx_LEGACY" onChange={() => {}} />,
    );

    expect(html).toContain("xx_LEGACY");
  });

  it("shows an empty field when no value is selected yet", () => {
    const html = renderToStaticMarkup(
      <SearchableSelect options={LANGUAGE_OPTIONS} value="" onChange={() => {}} />,
    );

    expect(html).toContain('value=""');
    expect(html).toContain('placeholder="Search...');
  });

  it("does not render the options panel before the user opens it", () => {
    const html = renderToStaticMarkup(
      <SearchableSelect options={LANGUAGE_OPTIONS} value="en" onChange={() => {}} />,
    );

    expect(html).not.toContain('role="listbox"');
  });

  it("marks the field required when configured to", () => {
    const html = renderToStaticMarkup(
      <SearchableSelect options={LANGUAGE_OPTIONS} value="" onChange={() => {}} required />,
    );

    expect(html).toContain("required=\"\"");
  });
});
