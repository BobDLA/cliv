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
  const { setSelection } = useSelectionStore();
  const debounceRef = useRef<number>(0);

  const handleSelectionChange = useCallback(() => {
    // CRITICAL: skip when popup is open — clicking textarea collapses selection
    if (useSelectionStore.getState().showPopup) return;

    cancelAnimationFrame(debounceRef.current);
    debounceRef.current = requestAnimationFrame(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) {
        setSelection(null);
        return;
      }

      const container = containerRef.current;
      if (!container) return;

      const range = sel.getRangeAt(0);

      // Ensure selection is within our container
      if (!container.contains(range.commonAncestorContainer)) {
        return;
      }

      const quote = sel.toString().trim();
      if (!quote || quote.length < 2) {
        setSelection(null);
        return;
      }

      const rect = range.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      // Calculate offsets relative to container's text content
      const preRange = document.createRange();
      preRange.selectNodeContents(container);
      preRange.setEnd(range.startContainer, range.startOffset);
      const startOffset = preRange.toString().length;

      const info: SelectionInfo = {
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

      setSelection(info);
    });
  }, [containerRef, setSelection]);

  useEffect(() => {
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
      cancelAnimationFrame(debounceRef.current);
    };
  }, [handleSelectionChange]);

  // This component renders nothing — it's a listener only
  return null;
});
