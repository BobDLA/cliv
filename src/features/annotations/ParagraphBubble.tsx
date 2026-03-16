import { memo, useState, useCallback, useRef, useEffect } from "react";
import { MessageSquare } from "lucide-react";
import { useSelectionStore } from "@/stores";

/**
 * ParagraphBubble — chat-bubble icon at paragraph right edge on hover.
 * Clicking annotates the entire paragraph.
 * Ref: doc/reference/image copy 5.png
 */
export const ParagraphBubble = memo(function ParagraphBubble({
  containerRef,
}: {
  containerRef: React.RefObject<HTMLElement | null>;
}) {
  const { setSelection, openPopup } = useSelectionStore();
  const [bubble, setBubble] = useState<{
    top: number;
    right: number;
    element: HTMLElement;
  } | null>(null);
  const hideTimerRef = useRef<number>(0);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;

      // Don't show when popup is open
      if (useSelectionStore.getState().showPopup) {
        setBubble(null);
        return;
      }

      // Don't show when user is selecting text
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) {
        setBubble(null);
        return;
      }

      const target = e.target as HTMLElement;
      const paragraph = target.closest(
        "p, h1, h2, h3, h4, h5, h6, li, blockquote",
      ) as HTMLElement | null;

      if (!paragraph || !container.contains(paragraph)) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = window.setTimeout(() => setBubble(null), 200);
        return;
      }

      clearTimeout(hideTimerRef.current);

      const pRect = paragraph.getBoundingClientRect();
      const cRect = container.getBoundingClientRect();

      setBubble({
        top:
          pRect.top - cRect.top + container.scrollTop + pRect.height / 2 - 12,
        right: 0, // flush to container right edge
        element: paragraph,
      });
    },
    [containerRef],
  );

  const handleMouseLeave = useCallback(() => {
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => setBubble(null), 300);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseleave", handleMouseLeave);
      clearTimeout(hideTimerRef.current);
    };
  }, [containerRef, handleMouseMove, handleMouseLeave]);

  const handleClick = useCallback(() => {
    if (!bubble) return;
    const container = containerRef.current;
    if (!container) return;

    const paragraph = bubble.element;
    const text = paragraph.textContent?.trim() ?? "";
    if (!text) return;

    // Calculate paragraph offset
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let offset = 0;
    let found = false;
    let node: Node | null;

    while ((node = walker.nextNode())) {
      if (paragraph.contains(node)) {
        if (!found) found = true;
      } else if (found) {
        break;
      }
      if (!found) {
        offset += node.textContent?.length ?? 0;
      }
    }

    const pRect = paragraph.getBoundingClientRect();
    const cRect = container.getBoundingClientRect();

    setSelection({
      quote: text,
      range: {
        startOffset: offset,
        endOffset: offset + text.length,
        contextSnippet: text.slice(0, 80),
      },
      rect: {
        top: pRect.top - cRect.top + container.scrollTop,
        left: pRect.left - cRect.left,
        bottom: pRect.bottom - cRect.top + container.scrollTop,
        width: pRect.width,
      },
    });

    openPopup();
  }, [bubble, containerRef, setSelection, openPopup]);

  if (!bubble) return null;

  return (
    <button
      type="button"
      onClick={handleClick}
      onMouseEnter={() => clearTimeout(hideTimerRef.current)}
      onMouseLeave={handleMouseLeave}
      title="批注整段"
      style={{
        position: "absolute",
        top: `${bubble.top}px`,
        right: "-36px",
        width: "24px",
        height: "24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "var(--radius-sm)",
        backgroundColor: "transparent",
        color: "var(--color-text-faint)",
        border: "none",
        cursor: "pointer",
        transition: "all 0.15s",
        opacity: 0.5,
      }}
      onMouseOver={(e) => {
        const el = e.currentTarget;
        el.style.opacity = "1";
        el.style.color = "var(--color-accent)";
        el.style.backgroundColor = "var(--color-accent-glow)";
      }}
      onMouseOut={(e) => {
        const el = e.currentTarget;
        el.style.opacity = "0.5";
        el.style.color = "var(--color-text-faint)";
        el.style.backgroundColor = "transparent";
      }}
    >
      <MessageSquare style={{ width: "14px", height: "14px" }} />
    </button>
  );
});
