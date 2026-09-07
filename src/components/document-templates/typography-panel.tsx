"use client";

import { inputClass } from "@/components/ui/page";
import {
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  resolveTypography,
  type FontStyle,
  type FontWeight,
  type LayoutTextElement,
  type TextAlign,
  type TextDecoration,
} from "@/lib/validation/document-template-layout";

export type TypographyPanelProps = {
  element: LayoutTextElement | null;
  onChange: (patch: Partial<LayoutTextElement>) => void;
};

const FONT_SIZE_STEP = 2;

const ALIGN_OPTIONS: Array<{ value: TextAlign; label: string }> = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
];

const toggleButtonClass = (active: boolean) =>
  `inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
    active
      ? "border-primary bg-primary/10 text-primary"
      : "border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
  }`;

function clampFontSize(value: number): number {
  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Math.round(value)));
}

/** Prevents formatting controls from stealing focus away from the active text box's textarea. */
function preventFocusSteal(event: React.MouseEvent) {
  event.preventDefault();
}

export function TypographyPanel({ element, onChange }: TypographyPanelProps) {
  const disabled = !element;
  const typography = element
    ? resolveTypography(element)
    : {
        fontWeight: "normal" as FontWeight,
        fontStyle: "normal" as FontStyle,
        textDecoration: "none" as TextDecoration,
        textAlign: "left" as TextAlign,
      };
  const fontSize = element?.fontSize ?? MIN_FONT_SIZE;
  const color = element?.color ?? "#000000";

  function setFontSize(next: number) {
    onChange({ fontSize: clampFontSize(next) });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
      <span className="text-xs font-medium text-stone-600">
        {disabled ? "Select a text box to format it:" : "Format:"}
      </span>

      <div className="flex items-center gap-1">
        <input
          type="number"
          aria-label="Font size"
          className={`${inputClass} w-16 px-2 py-1`}
          min={MIN_FONT_SIZE}
          max={MAX_FONT_SIZE}
          value={fontSize}
          disabled={disabled}
          onChange={(event) => {
            const parsed = Number(event.target.value);
            if (Number.isFinite(parsed)) {
              setFontSize(parsed);
            }
          }}
        />
        <button
          type="button"
          aria-label="Decrease font size"
          className={toggleButtonClass(false)}
          disabled={disabled}
          onMouseDown={preventFocusSteal}
          onClick={() => setFontSize(fontSize - FONT_SIZE_STEP)}
        >
          −
        </button>
        <button
          type="button"
          aria-label="Increase font size"
          className={toggleButtonClass(false)}
          disabled={disabled}
          onMouseDown={preventFocusSteal}
          onClick={() => setFontSize(fontSize + FONT_SIZE_STEP)}
        >
          +
        </button>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Bold"
          aria-pressed={typography.fontWeight === "bold"}
          className={`${toggleButtonClass(typography.fontWeight === "bold")} font-bold`}
          disabled={disabled}
          onMouseDown={preventFocusSteal}
          onClick={() =>
            onChange({
              fontWeight: typography.fontWeight === "bold" ? "normal" : "bold",
            })
          }
        >
          B
        </button>
        <button
          type="button"
          aria-label="Italic"
          aria-pressed={typography.fontStyle === "italic"}
          className={`${toggleButtonClass(typography.fontStyle === "italic")} italic`}
          disabled={disabled}
          onMouseDown={preventFocusSteal}
          onClick={() =>
            onChange({
              fontStyle: typography.fontStyle === "italic" ? "normal" : "italic",
            })
          }
        >
          I
        </button>
        <button
          type="button"
          aria-label="Underline"
          aria-pressed={typography.textDecoration === "underline"}
          className={`${toggleButtonClass(typography.textDecoration === "underline")} underline`}
          disabled={disabled}
          onMouseDown={preventFocusSteal}
          onClick={() =>
            onChange({
              textDecoration:
                typography.textDecoration === "underline" ? "none" : "underline",
            })
          }
        >
          U
        </button>
      </div>

      <div className="flex items-center gap-1">
        {ALIGN_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-label={`Align ${option.label.toLowerCase()}`}
            aria-pressed={typography.textAlign === option.value}
            className={toggleButtonClass(typography.textAlign === option.value)}
            disabled={disabled}
            onMouseDown={preventFocusSteal}
            onClick={() => onChange({ textAlign: option.value })}
          >
            {option.label}
          </button>
        ))}
      </div>

      <label className="flex items-center gap-1.5 text-xs font-medium text-stone-600">
        Color
        <input
          type="color"
          aria-label="Text color"
          className="h-8 w-8 cursor-pointer rounded-md border border-stone-300 bg-white p-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          value={color}
          disabled={disabled}
          onChange={(event) => onChange({ color: event.target.value })}
        />
      </label>
    </div>
  );
}
