"use client";

type StatusFilterOption = {
  value: string;
  label: string;
};

type StatusFilterChipsProps = {
  options: readonly StatusFilterOption[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
};

export function StatusFilterChips({
  options,
  value,
  onChange,
  ariaLabel = "Filter by status",
}: StatusFilterChipsProps) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isActive = option.value === value;

        return (
          <button
            key={option.label}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(option.value)}
            className={[
              "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-white"
                : "bg-stone-100 text-stone-700 hover:bg-stone-200",
            ].join(" ")}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
