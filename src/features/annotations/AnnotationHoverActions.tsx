import { memo, useEffect, useState, useRef, useCallback } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useAnnotationStore } from "@/stores";
import { getAnnotationRect } from "./AnnotationOverlay";
import { useT } from "@/lib/useT";

/**
 * AnnotationHoverActions — floating mini-toolbar above annotated text.
 *
 * Key design: we track a LOCAL `visibleId` with delayed clearing,
 * separate from the store's hoveredAnnotationId. This way, when
 * the cursor leaves the highlighted text (heading toward the toolbar),
 * the toolbar stays visible long enough to be clicked.
 */
export const AnnotationHoverActions = memo(function AnnotationHoverActions({
  containerRef,
}: {
  containerRef: React.RefObject<HTMLElement | null>;
}) {
  const { setEditingAnnotation, removeAnnotation } = useAnnotationStore();
  const hoveredAnnotationId = useAnnotationStore((s) => s.hoveredAnnotationId);
  const t = useT();

  // Local state: which annotation's toolbar is visible
  // This has DELAYED clearing so the toolbar stays clickable
  const [visibleId, setVisibleId] = useState<string | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const isOverToolbar = useRef(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Compute toolbar position from annotation's DOM rect
  const computePos = useCallback(
    (annId: string) => {
      const container = containerRef.current;
      if (!container) return;

      const ann = useAnnotationStore
        .getState()
        .annotations.find((a) => a.id === annId);
      if (!ann) return;

      const rect = getAnnotationRect(container, ann);
      if (!rect) return;

      const containerRect = container.getBoundingClientRect();
      setPos({
        top: rect.top - containerRect.top - 34,
        left: rect.left - containerRect.left,
      });
    },
    [containerRef],
  );

  // When store's hoveredAnnotationId changes:
  // - If a new annotation is hovered → show immediately
  // - If cleared (null) → delay before hiding
  useEffect(() => {
    clearTimeout(hideTimer.current);

    if (hoveredAnnotationId) {
      // Show immediately
      setVisibleId(hoveredAnnotationId);
      computePos(hoveredAnnotationId);
    } else {
      // Delay hide to allow mouse to reach toolbar
      hideTimer.current = setTimeout(() => {
        if (!isOverToolbar.current) {
          setVisibleId(null);
          setPos(null);
        }
      }, 600);
    }

    return () => clearTimeout(hideTimer.current);
  }, [hoveredAnnotationId, computePos]);

  // Render nothing if not visible
  if (!visibleId || !pos) return null;

  return (
    <div
      onMouseEnter={() => {
        isOverToolbar.current = true;
        clearTimeout(hideTimer.current);
        // Also keep the store's hover state alive for highlight
        useAnnotationStore.getState().setHoveredAnnotation(visibleId);
      }}
      onMouseLeave={() => {
        isOverToolbar.current = false;
        setVisibleId(null);
        setPos(null);
        useAnnotationStore.getState().setHoveredAnnotation(null);
      }}
      style={{
        position: "absolute",
        top: `${pos.top}px`,
        left: `${Math.max(0, pos.left)}px`,
        zIndex: 40,
        display: "flex",
        gap: "2px",
        padding: "3px 4px",
        borderRadius: "6px",
        backgroundColor: "var(--color-surface-popover)",
        border: "1px solid var(--color-border-subtle)",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        fontFamily: "var(--font-sans)",
        pointerEvents: "auto",
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setEditingAnnotation(visibleId);
          setVisibleId(null);
          setPos(null);
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          padding: "4px 8px",
          borderRadius: "4px",
          border: "none",
          backgroundColor: "transparent",
          color: "var(--color-text-secondary)",
          cursor: "pointer",
          fontSize: "12px",
          fontFamily: "var(--font-sans)",
          transition: "all 0.12s",
          whiteSpace: "nowrap",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "var(--color-surface-hover)";
          e.currentTarget.style.color = "var(--color-accent)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "transparent";
          e.currentTarget.style.color = "var(--color-text-secondary)";
        }}
      >
        <Pencil style={{ width: "13px", height: "13px" }} />
        {t("annHover.edit")}
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          removeAnnotation(visibleId);
          setVisibleId(null);
          setPos(null);
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          padding: "4px 8px",
          borderRadius: "4px",
          border: "none",
          backgroundColor: "transparent",
          color: "var(--color-text-secondary)",
          cursor: "pointer",
          fontSize: "12px",
          fontFamily: "var(--font-sans)",
          transition: "all 0.12s",
          whiteSpace: "nowrap",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.08)";
          e.currentTarget.style.color = "#ef4444";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "transparent";
          e.currentTarget.style.color = "var(--color-text-secondary)";
        }}
      >
        <Trash2 style={{ width: "13px", height: "13px" }} />
        {t("annHover.delete")}
      </button>
    </div>
  );
});
