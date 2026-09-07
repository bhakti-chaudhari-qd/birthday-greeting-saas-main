"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";

import { MIN_LAYOUT_ELEMENT_HEIGHT } from "@/lib/validation/document-template-layout";

import { TextBox, type LayoutTextElement } from "./text-box";

export type OverlayLayerProps = {
  containerRef: RefObject<HTMLDivElement | null>;
  elements: LayoutTextElement[];
  onElementChange: (elementId: string, patch: Partial<LayoutTextElement>) => void;
  onDelete: (elementId: string) => void;
  onFocusElement: (elementId: string) => void;
  onRegisterTextarea: (
    elementId: string,
    node: HTMLTextAreaElement | null,
  ) => void;
};

/** Floor so a resized box always stays grabbable; mirrors the server-side min. */
const MIN_ELEMENT_WIDTH = 0.02;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

/**
 * Pure resize math shared by the corner handle's pointermove handler and
 * unit tests. `pointer` is the current pointer position already normalized
 * to 0-1 document coordinates (same coordinate system as x/y/width); `start`
 * is the box's x/y captured when the resize gesture began. Mirrors the
 * existing width-only clamp (`1 - left`) for the new height axis
 * (`1 - top`), per the page-boundary rule: a manually resized height must
 * never push the box past the bottom of the page, unlike width today.
 */
export function computeResizedDimensions(
  pointer: { x: number; y: number },
  start: { left: number; top: number },
): { width: number; height: number } {
  return {
    width: clamp(pointer.x - start.left, MIN_ELEMENT_WIDTH, 1 - start.left),
    height: clamp(
      pointer.y - start.top,
      MIN_LAYOUT_ELEMENT_HEIGHT,
      1 - start.top,
    ),
  };
}

export function OverlayLayer({
  containerRef,
  elements,
  onElementChange,
  onDelete,
  onFocusElement,
  onRegisterTextarea,
}: OverlayLayerProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const [resizingId, setResizingId] = useState<string | null>(null);
  const resizeStartRef = useRef({ left: 0, top: 0 });

  function handleDragHandlePointerDown(
    event: ReactPointerEvent<HTMLDivElement>,
    elementId: string,
  ) {
    const container = containerRef.current;
    const element = elements.find((item) => item.id === elementId);
    if (!container || !element) {
      return;
    }

    const rect = container.getBoundingClientRect();
    const pointerX = (event.clientX - rect.left) / rect.width;
    const pointerY = (event.clientY - rect.top) / rect.height;
    dragOffsetRef.current = {
      x: pointerX - element.x,
      y: pointerY - element.y,
    };
    setDraggingId(elementId);
  }

  useEffect(() => {
    if (!draggingId) {
      return;
    }

    function handlePointerMove(event: PointerEvent) {
      const container = containerRef.current;
      if (!container || !draggingId) {
        return;
      }

      const rect = container.getBoundingClientRect();
      const x = clamp01(
        (event.clientX - rect.left) / rect.width - dragOffsetRef.current.x,
      );
      const y = clamp01(
        (event.clientY - rect.top) / rect.height - dragOffsetRef.current.y,
      );
      onElementChange(draggingId, { x, y });
    }

    function handlePointerUp() {
      setDraggingId(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggingId]);

  function handleResizeHandlePointerDown(
    event: ReactPointerEvent<HTMLDivElement>,
    elementId: string,
  ) {
    const element = elements.find((item) => item.id === elementId);
    if (!element) {
      return;
    }

    resizeStartRef.current = { left: element.x, top: element.y };
    setResizingId(elementId);
  }

  useEffect(() => {
    if (!resizingId) {
      return;
    }

    function handlePointerMove(event: PointerEvent) {
      const container = containerRef.current;
      if (!container || !resizingId) {
        return;
      }

      const rect = container.getBoundingClientRect();
      const pointer = {
        x: (event.clientX - rect.left) / rect.width,
        y: (event.clientY - rect.top) / rect.height,
      };
      const { width, height } = computeResizedDimensions(
        pointer,
        resizeStartRef.current,
      );
      onElementChange(resizingId, { width, height });
    }

    function handlePointerUp() {
      setResizingId(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resizingId]);

  return (
    <div className="absolute inset-0">
      {elements.map((element) => (
        <TextBox
          key={element.id}
          element={element}
          onDragHandlePointerDown={handleDragHandlePointerDown}
          onResizeHandlePointerDown={handleResizeHandlePointerDown}
          onTextChange={(elementId, text) =>
            onElementChange(elementId, { text })
          }
          onDelete={onDelete}
          onFocus={onFocusElement}
          onRegisterTextarea={onRegisterTextarea}
        />
      ))}
    </div>
  );
}
