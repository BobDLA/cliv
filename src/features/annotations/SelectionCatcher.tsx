import { memo, useCallback, useEffect, useRef } from "react";
import { useSelectionStore } from "@/stores";
import type { SelectionInfo } from "@/types";

/**
 * SelectionCatcher — 监听文档内的文本选区变化。
 * 当用户在 containerRef 内选中文本时，计算 quote + offset + rect
 * 并写入 SelectionStore。
 *
 * 注意：当 popup 已打开时，忽略 selectionchange 事件，
 * 避免用户点击 textarea 时因选区塌缩导致 popup 消失。
 */
export const SelectionCatcher = memo(function SelectionCatcher({
  containerRef,
}: {
  containerRef: React.RefObject<HTMLElement | null>;
}) {
  const { setSelection, openPopup } = useSelectionStore();
  const debounceRef = useRef<number>(0);
  const mouseUpRef = useRef<number>(0);

  const handleSelectionChange = useCallback(() => {
    // CRITICAL: skip when popup is open — clicking textarea collapses selection
    if (useSelectionStore.getState().showPopup) return;

    cancelAnimationFrame(debounceRef.current);
    debounceRef.current = requestAnimationFrame(() => {
      if (useSelectionStore.getState().showPopup) return;
      const container = containerRef.current;
      if (!container) return;
      setSelection(readSelectionInfo(container));
    });
  }, [containerRef, setSelection]);

  const handleMouseUp = useCallback(() => {
    cancelAnimationFrame(mouseUpRef.current);
    mouseUpRef.current = requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container) return;

      const nextSelection = readSelectionInfo(container);
      if (!nextSelection) return;

      if (useSelectionStore.getState().showPopup) {
        return;
      }

      setSelection(nextSelection);
      openPopup();
    });
  }, [containerRef, openPopup, setSelection]);

  useEffect(() => {
    document.addEventListener("selectionchange", handleSelectionChange);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
      document.removeEventListener("mouseup", handleMouseUp);
      cancelAnimationFrame(debounceRef.current);
      cancelAnimationFrame(mouseUpRef.current);
    };
  }, [handleMouseUp, handleSelectionChange]);

  // This component renders nothing — it's a listener only
  return null;
});

function readSelectionInfo(container: HTMLElement): SelectionInfo | null {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) {
    return null;
  }

  const range = sel.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) {
    return null;
  }

  const quote = sel.toString().trim();
  if (!quote || quote.length < 2) {
    return null;
  }

  const rect = range.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();

  const preRange = document.createRange();
  preRange.selectNodeContents(container);
  preRange.setEnd(range.startContainer, range.startOffset);
  const startOffset = preRange.toString().length;

  return {
    quote,
    range: {
      startOffset,
      endOffset: startOffset + quote.length,
      contextSnippet: quote.slice(0, 80),
    },
    rect: {
      top: rect.top - containerRect.top + container.scrollTop,
      left: rect.left - containerRect.left,
      bottom: rect.bottom - containerRect.top + container.scrollTop,
      width: rect.width,
    },
  };
}
