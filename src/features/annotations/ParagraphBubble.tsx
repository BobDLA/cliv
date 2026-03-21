import { memo, useState, useCallback, useRef, useEffect } from "react";
import { MessageSquarePlus } from "lucide-react";
import { useSelectionStore } from "@/stores";

// Block-level selectors that can be annotated as a "paragraph"
const BLOCK_SELECTOR =
  "p, h1, h2, h3, h4, h5, h6, li, blockquote, table, pre";

/**
 * ParagraphBubble — floating annotation button that appears when hovering
 * over a paragraph block in the document.
 *
 * Design v2:
 *   - Positioned as a pill at the LEFT edge of the paragraph
 *   - Larger hit area (32×32) with visible icon + background
 *   - Highlights the target paragraph with a left accent border
 *   - Snaps to nearest block-level element for reliable targeting
 */
export const ParagraphBubble = memo(function ParagraphBubble({
  containerRef,
}: {
  containerRef: React.RefObject<HTMLElement | null>;
}) {
  const { setSelection, openPopup } = useSelectionStore();
  const [target, setTarget] = useState<{
    top: number;
    height: number;
    barRightCss: number;
    buttonRightCss: number;
    element: HTMLElement;
  } | null>(null);
  const hideTimerRef = useRef<number>(0);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;

      // Don't show when popup is open
      if (useSelectionStore.getState().showPopup) {
        setTarget(null);
        return;
      }

      // Don't show when user is selecting text
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) {
        setTarget(null);
        return;
      }

      const el = e.target as HTMLElement;

      // Find nearest block-level ancestor (skip inline elements like <span>, <code>, <a>)
      const block = el.closest(BLOCK_SELECTOR) as HTMLElement | null;

      if (!block || !container.contains(block)) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = window.setTimeout(() => setTarget(null), 300);
        return;
      }

      // Skip code blocks inside <pre> — they are not meaningful paragraphs
      if (block.tagName === "PRE" || block.closest("pre")) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = window.setTimeout(() => setTarget(null), 800);
        return;
      }

      clearTimeout(hideTimerRef.current);

      const blockRect = block.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      // Zoom correction: getBoundingClientRect returns viewport px,
      // but CSS properties (right/top) need CSS px. Under page zoom they differ.
      const zoom = containerRect.width / container.offsetWidth || 1;

      // Vertical positioning in CSS px
      const topCss =
        (blockRect.top - containerRect.top) / zoom + container.scrollTop;
      const heightCss = blockRect.height / zoom;

      // Find the resize-handle divider by querying for its unique cursor style.
      // We cannot rely on parentElement.nextElementSibling because the containerRef
      // can be nested several levels deep inside the document column.
      const scrollRoot = container.closest('.flex');
      const handleEl = scrollRoot?.querySelector<HTMLElement>('[style*="col-resize"]') ?? null;
      const handleRect = handleEl?.getBoundingClientRect() ?? null;

      // Distance from container's right edge to the handle's left edge, in CSS px
      const distCss = handleRect
        ? (handleRect.left - containerRect.right) / zoom
        : 24; // fallback: parent padding

      // Button's right edge sits 2px left of the divider
      const buttonRightCss = -(distCss - 2);

      // Accent bar flush against the divider
      const barRightCss = -(distCss - 1);

      setTarget({
        top: topCss,
        height: heightCss,
        barRightCss,
        buttonRightCss,
        element: block,
      });
    },
    [containerRef],
  );

  const handleMouseLeave = useCallback(() => {
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => setTarget(null), 800);
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
    if (!target) return;
    const container = containerRef.current;
    if (!container) return;

    const paragraph = target.element;
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
  }, [target, containerRef, setSelection, openPopup]);

  if (!target) return null;

  return (
    <>
      {/* Left accent bar — shows which paragraph will be annotated */}
      <div
        style={{
          position: "absolute",
          top: `${target.top}px`,
          right: `${target.barRightCss}px`,
          width: "3px",
          height: `${target.height}px`,
          borderRadius: "2px",
          backgroundColor: "var(--color-accent)",
          opacity: 0.5,
          transition: "top 0.12s ease-out, height 0.12s ease-out",
          pointerEvents: "none",
        }}
      />

      {/* Annotation button — left gutter */}
      <button
        type="button"
        onClick={handleClick}
        onMouseEnter={() => clearTimeout(hideTimerRef.current)}
        onMouseLeave={handleMouseLeave}
        title="批注整段"
        style={{
          position: "absolute",
          top: `${target.top + target.height / 2 - 12}px`,
          right: `${target.buttonRightCss}px`,
          width: "24px",
          height: "24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "6px",
          backgroundColor: "var(--color-accent-glow)",
          color: "var(--color-accent)",
          border: "1px solid var(--color-accent)",
          cursor: "pointer",
          transition: "all 0.15s ease-out",
          opacity: 0.8,
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        }}
        onMouseOver={(e) => {
          const el = e.currentTarget;
          el.style.opacity = "1";
          el.style.transform = "scale(1.1)";
          el.style.boxShadow = "0 4px 12px rgba(59,130,246,0.3)";
        }}
        onMouseOut={(e) => {
          const el = e.currentTarget;
          el.style.opacity = "0.8";
          el.style.transform = "scale(1)";
          el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)";
        }}
      >
        <MessageSquarePlus style={{ width: "13px", height: "13px" }} />
      </button>
    </>
  );
});
