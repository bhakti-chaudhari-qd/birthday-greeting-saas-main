"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import { inputClass } from "@/components/ui/page";

import type { OrgCategory } from "./types";

type CategoryMultiSelectProps = {
  categories: OrgCategory[];
  selectedCategories: OrgCategory[];
  onChange: (categories: OrgCategory[]) => void;
  label?: string;
  emptyLabel?: string;
  placeholder?: string;
  maxVisibleChips?: number;
};

export function CategoryMultiSelect({
  categories,
  selectedCategories,
  onChange,
  label = "Selected Categories",
  emptyLabel = "No categories selected",
  placeholder = "Search categories...",
  maxVisibleChips = 3,
}: CategoryMultiSelectProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  const selectedIds = useMemo(
    () => new Set(selectedCategories.map((category) => category.id)),
    [selectedCategories],
  );
  const selectedChips = selectedCategories.slice(0, maxVisibleChips);
  const hiddenSelectedCount = Math.max(
    0,
    selectedCategories.length - selectedChips.length,
  );
  const allSelected =
    categories.length > 0 && selectedCategories.length === categories.length;
  const someSelected = selectedCategories.length > 0 && !allSelected;
  const filteredCategories = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return categories;
    return categories.filter((category) =>
      category.name.toLowerCase().includes(term),
    );
  }, [categories, query]);

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

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  function toggleCategory(category: OrgCategory) {
    onChange(
      selectedIds.has(category.id)
        ? selectedCategories.filter((selected) => selected.id !== category.id)
        : [...selectedCategories, category],
    );
  }

  function toggleAllCategories() {
    onChange(allSelected ? [] : categories);
  }

  function removeCategory(categoryId: string) {
    onChange(
      selectedCategories.filter((category) => category.id !== categoryId),
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div>
        <span className="text-xs font-medium text-stone-700">{label}</span>
        {selectedCategories.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {selectedChips.map((category) => (
              <span
                key={category.id}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs font-medium text-stone-800"
              >
                <span className="truncate">{category.name}</span>
                <button
                  type="button"
                  className="rounded-full px-1 text-stone-500 outline-none hover:bg-stone-200 hover:text-stone-800 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                  onClick={() => removeCategory(category.id)}
                  aria-label={`Remove ${category.name}`}
                >
                  x
                </button>
              </span>
            ))}
            {hiddenSelectedCount > 0 ? (
              <span className="inline-flex items-center rounded-full px-1 py-1 text-xs font-medium text-stone-500">
                +{hiddenSelectedCount} more
              </span>
            ) : null}
          </div>
        ) : (
          <p className="mt-1 text-xs text-stone-500">{emptyLabel}</p>
        )}
      </div>

      <div ref={rootRef} className="relative">
        <input
          className={`${inputClass} pr-9`}
          placeholder={placeholder}
          value={query}
          onClick={() => setOpen((current) => !current)}
          onChange={(event) => setQuery(event.target.value)}
          role="combobox"
          aria-controls={listboxId}
          aria-expanded={open ? "true" : "false"}
          aria-haspopup="listbox"
        />
        <button
          type="button"
          className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-xs text-stone-500 outline-none hover:bg-stone-100 hover:text-stone-800 focus-visible:ring-2 focus-visible:ring-primary"
          onClick={() => setOpen((current) => !current)}
          aria-label={open ? "Close categories" : "Open categories"}
        >
          v
        </button>
        {open ? (
          <div
            id={listboxId}
            role="listbox"
            className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-stone-200 bg-white shadow-lg"
          >
            <label className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm hover:bg-stone-50">
              <input
                ref={selectAllRef}
                type="checkbox"
                checked={allSelected}
                onChange={toggleAllCategories}
                aria-label="Select all categories"
              />
              <span className="min-w-0 truncate font-medium text-stone-900">
                Select All
              </span>
            </label>
            <div className="border-t border-stone-200" />
            {filteredCategories.length > 0 ? (
              <ul className="max-h-56 overflow-y-auto">
                {filteredCategories.map((category) => {
                  const selected = selectedIds.has(category.id);

                  return (
                    <li key={category.id}>
                      <label className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm hover:bg-stone-50">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleCategory(category)}
                          aria-label={`Select ${category.name}`}
                        />
                        <span className="min-w-0 truncate font-medium text-stone-900">
                          {category.name}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-3 py-2 text-xs text-stone-500">
                No matching categories
              </p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
