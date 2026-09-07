"use client";

import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";

import { VariableHighlightedText } from "@/lib/document-templates/variable-highlight";
import {
  resolveTypography,
  type LayoutTextElement,
} from "@/lib/validation/document-template-layout";

export type { LayoutTextElement } from "@/lib/validation/document-template-layout";

export type TextBoxProps = {
  element: LayoutTextElement;
  onDragHandlePointerDown: (
    event: ReactPointerEvent<HTMLDivElement>,
    elementId: string,
  ) => void;
  onResizeHandlePointerDown: (
    event: ReactPointerEvent<HTMLDivElement>,
    elementId: string,
  ) => void;
  onTextChange: (elementId: string, text: string) => void;
  onDelete: (elementId: string) => void;
  onFocus: (elementId: string) => void;
  onRegisterTextarea: (
    elementId: string,
    node: HTMLTextAreaElement | null,
  ) => void;
};

/** Shared between the highlight layer and the input layer so wrapping lines up exactly. */
const TEXT_LAYER_CLASS =
  "block w-full whitespace-pre-wrap break-words p-0.5 leading-tight";

/**
 * Typography that affects text metrics/flow (size, weight, style, align)
 * must be identical on both layers or the invisible textarea's wrapping
 * would drift from the highlighted div rendered behind it.
 */
function typographyStyle(element: LayoutTextElement): CSSProperties {
  const typography = resolveTypography(element);
  return {
    fontSize: element.fontSize,
    fontWeight: typography.fontWeight,
    fontStyle: typography.fontStyle,
    textDecoration: typography.textDecoration,
    textAlign: typography.textAlign,
  };
}

export function TextBox({
  element,
  onDragHandlePointerDown,
  onResizeHandlePointerDown,
  onTextChange,
  onDelete,
  onFocus,
  onRegisterTextarea,
}: TextBoxProps) {
  const { height } = element;
  const hasFixedHeight = height !== undefined;

  return (
    <div
      className="absolute border border-dashed border-primary/50 bg-white/70"
      style={{
        left: `${element.x * 100}%`,
        top: `${element.y * 100}%`,
        width: `${element.width * 100}%`,
        // height undefined (the default, and every pre-height stored
        // element) keeps today's pure content-driven auto height - only a
        // manually resized element gets a fixed height, via a flex column so
        // the wrapper below can fill the remaining space after the header.
        ...(hasFixedHeight
          ? { height: `${height * 100}%`, display: "flex", flexDirection: "column" as const }
          : {}),
      }}
    >
      <div
        className="flex cursor-grab items-center justify-between bg-primary/10 px-1 text-[10px] leading-tight text-stone-600 select-none active:cursor-grabbing"
        onPointerDown={(event) => onDragHandlePointerDown(event, element.id)}
      >
        <span>⠿</span>
        <button
          type="button"
          className="px-1 font-semibold text-stone-500 hover:text-red-600"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onDelete(element.id)}
          aria-label="Delete text box"
        >
          ×
        </button>
      </div>

      {/*
        Dual-layer text: a textarea can't style part of its own value, so an
        invisible-text textarea sits on top (owns typing/cursor/selection)
        while a same-font div behind it renders the highlighted version.
        Auto-height (no stored height): the div is in normal flow and drives
        the box height; the textarea is absolutely positioned to fill exactly
        that height. Fixed height: this wrapper fills the flex column's
        remaining space instead, and the highlight div is stretched to match
        it (height: 100%) - the textarea's existing inset-0 already follows
        whatever height the wrapper ends up being, in both cases, unchanged.
        Content taller than a manually fixed height is intentionally allowed
        to visually overflow rather than being clipped or auto-expanded.
      */}
      <div
        className="relative w-full"
        style={hasFixedHeight ? { flex: 1 } : undefined}
      >
        <div
          aria-hidden="true"
          className={TEXT_LAYER_CLASS}
          style={{
            ...typographyStyle(element),
            color: element.color,
            ...(hasFixedHeight ? { height: "100%" } : {}),
          }}
        >
          <VariableHighlightedText text={element.text} />
        </div>
        <textarea
          ref={(node) => onRegisterTextarea(element.id, node)}
          value={element.text}
          onChange={(event) => onTextChange(element.id, event.target.value)}
          onFocus={() => onFocus(element.id)}
          onPointerDown={(event) => event.stopPropagation()}
          className={`${TEXT_LAYER_CLASS} absolute inset-0 resize-none overflow-hidden border-0 bg-transparent text-transparent outline-none`}
          style={{ ...typographyStyle(element), caretColor: element.color }}
          rows={1}
        />
      </div>

      <div
        className="absolute right-0 bottom-0 h-3 w-3 translate-x-1/2 translate-y-1/2 cursor-ew-resize rounded-sm border border-primary/60 bg-white"
        onPointerDown={(event) => {
          event.stopPropagation();
          onResizeHandlePointerDown(event, element.id);
        }}
        aria-hidden="true"
      />
    </div>
  );
}
