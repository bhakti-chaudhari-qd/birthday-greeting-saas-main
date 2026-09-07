"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import { inputClass } from "./page";

export type SearchableSelectOption = {
  value: string;
  label: string;
  /** Optional secondary text shown alongside the label (e.g. a code). */
  secondary?: string;
};

export type SearchableSelectProps = {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  required?: boolean;
  "aria-label"?: string;
};

function optionText(option: SearchableSelectOption): string {
  return option.secondary ? `${option.label} — ${option.secondary}` : option.label;
}

/**
 * Pure filter, factored out so search-by-label/search-by-code/search-by-value
 * matching is unit-testable without rendering or simulating DOM events.
 */
export function filterSearchableOptions(
  options: SearchableSelectOption[],
  query: string,
): SearchableSelectOption[] {
  const term = query.trim().toLowerCase();
  if (!term) {
    return options;
  }
  return options.filter(
    (option) =>
      option.label.toLowerCase().includes(term) ||
      option.value.toLowerCase().includes(term) ||
      (option.secondary?.toLowerCase().includes(term) ?? false),
  );
}

/**
 * Single-select searchable combobox: a text input filters a list of
 * label(+secondary) options; only clicking an option ever calls onChange,
 * so free-typed text can never be submitted as the value. Only calls
 * onChange with one of the supplied options' `value` - never the raw query.
 */
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Search...",
  emptyMessage = "No matches",
  disabled = false,
  required = false,
  "aria-label": ariaLabel,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listboxId = useId();

  const selected = useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  );

  const filteredOptions = useMemo(
    () => filterSearchableOptions(options, query),
    [options, query],
  );

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        event.stopImmediatePropagation();
        setOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [open]);

  function openAndSearch() {
    if (disabled) return;
    setQuery("");
    setOpen(true);
  }

  function selectOption(option: SearchableSelectOption) {
    onChange(option.value);
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <input
        className={`${inputClass} pr-9`}
        placeholder={placeholder}
        value={open ? query : selected ? optionText(selected) : value}
        onClick={openAndSearch}
        onFocus={openAndSearch}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        disabled={disabled}
        required={required}
        role="combobox"
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        autoComplete="off"
      />
      <button
        type="button"
        className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-xs text-stone-500 outline-none hover:bg-stone-100 hover:text-stone-800 focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
        onClick={() => (open ? setOpen(false) : openAndSearch())}
        disabled={disabled}
        aria-label={open ? "Close options" : "Open options"}
        tabIndex={-1}
      >
        ▾
      </button>

      {open ? (
        <div
          id={listboxId}
          role="listbox"
          className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-stone-200 bg-white shadow-lg"
        >
          {filteredOptions.length > 0 ? (
            <ul className="max-h-56 overflow-y-auto">
              {filteredOptions.map((option) => {
                const isSelected = option.value === value;
                return (
                  <li key={option.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-stone-50 ${
                        isSelected ? "bg-primary/5 font-medium text-primary" : "text-stone-800"
                      }`}
                      onClick={() => selectOption(option)}
                    >
                      <span className="min-w-0 truncate">{option.label}</span>
                      {option.secondary ? (
                        <span className="shrink-0 text-xs text-stone-500">
                          {option.secondary}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-3 py-2 text-xs text-stone-500">{emptyMessage}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
