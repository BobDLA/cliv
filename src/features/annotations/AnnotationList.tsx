import { memo, useEffect, useRef, useState, useCallback } from "react";
import { MessageSquare } from "lucide-react";
import { useAnnotationStore } from "@/stores";
import { AnnotationCard } from "./AnnotationCard";
import { getAnnotationRect } from "./AnnotationOverlay";
import { useT } from "@/lib/useT";

/**
 * AnnotationList — right margin panel with Word-style positioning.
 * Cards are absolutely positioned at the same vertical level
 * as their highlighted text, inside the same scroll container.
 *
 * Key: positions are calculated relative to the VIEWER's top,
 * NOT the viewport. Since both columns scroll together, absolute
 * positions stay stable without recalculating on scroll.
 */
export const AnnotationList = memo(function AnnotationList({
  viewerRef,
}: {
  viewerRef: React.RefObject<HTMLElement | null>;
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
}) {
  const { annotations } = useAnnotationStore();
  const t = useT();
  const listRef = useRef<HTMLDivElement>(null);
  const [positions, setPositions] = useState<Map<string, number>>(new Map());

  // Calculate positions relative to the viewer's content origin
  const recalcPositions = useCallback(() => {
    const viewer = viewerRef.current;
    const list = listRef.current;
    if (!viewer || !list) return;

    const newPositions = new Map<string, number>();
    const MIN_GAP = 8; // gap between cards
    let prevBottom = 0;

    // Sort by document offset
    const sorted = [...annotations].sort(
      (a, b) => (a.range?.startOffset ?? 0) - (b.range?.startOffset ?? 0),
    );

    // Use getBoundingClientRect difference — since both are in the
    // same scroll container, (rect.top - viewerRect.top) is constant
    // regardless of scroll position.
    const viewerRect = viewer.getBoundingClientRect();
    const listRect = list.getBoundingClientRect();

    for (const ann of sorted) {
      const rect = getAnnotationRect(viewer, ann);
      if (!rect) continue;

      // Distance from the viewer's top to the highlighted text
      const distFromViewerTop = rect.top - viewerRect.top;

      // Offset between the viewer's top and the list container's top
      const viewerToListOffset = listRect.top - viewerRect.top;

      // Final position within the list container
      const idealTop = distFromViewerTop - viewerToListOffset;

      // Prevent overlap: use measured card height or estimate
      const cardEl = list.querySelector(`[data-annotation-id="${ann.id}"]`);
      const cardHeight = cardEl ? cardEl.getBoundingClientRect().height : 70;

      const actualTop = Math.max(idealTop, prevBottom + MIN_GAP);
      newPositions.set(ann.id, actualTop);
      prevBottom = actualTop + cardHeight;
    }

    setPositions(newPositions);
  }, [annotations, viewerRef]);

  // Only recalculate when annotations change or window resizes
  // NOT on scroll — since both columns are in the same scroll container,
  // absolute positions within the list stay aligned automatically.
  useEffect(() => {
    // Initial calc (delayed for layout to settle)
    const timer = setTimeout(recalcPositions, 50);

    window.addEventListener("resize", recalcPositions);

    // Recalc after a short delay for any async layout changes
    // (e.g. images loading, mermaid diagrams rendering)
    const layoutTimer = setTimeout(recalcPositions, 500);

    return () => {
      clearTimeout(timer);
      clearTimeout(layoutTimer);
      window.removeEventListener("resize", recalcPositions);
    };
  }, [recalcPositions]);

  // Also recalculate when annotations are added/removed
  const prevLenRef = useRef(annotations.length);
  useEffect(() => {
    if (annotations.length !== prevLenRef.current) {
      prevLenRef.current = annotations.length;
      // Delay to let the new annotation's highlight render
      setTimeout(recalcPositions, 100);
    }
  }, [annotations.length, recalcPositions]);

  return (
    <div
      style={{
        position: "relative",
        minHeight: "100%",
      }}
    >
      {/* Cards — positioned by highlighted text's vertical position */}
      <div
        ref={listRef}
        style={{
          position: "relative",
          minHeight: "100%",
        }}
      >
        {annotations.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "48px 16px",
              textAlign: "center",
            }}
          >
            <MessageSquare
              style={{
                width: "32px",
                height: "32px",
                color: "var(--color-text-faint)",
                opacity: 0.3,
                marginBottom: "8px",
              }}
            />
            <p
              style={{
                fontSize: "12px",
                color: "var(--color-text-faint)",
                fontFamily: "var(--font-sans)",
              }}
            >
              {t("annList.hint")}
            </p>
            <p
              style={{
                fontSize: "10px",
                color: "var(--color-text-faint)",
                opacity: 0.6,
                marginTop: "4px",
                fontFamily: "var(--font-sans)",
              }}
            >
              Ctrl+Alt+M
            </p>
          </div>
        ) : (
          annotations
            .slice()
            .sort(
              (a, b) =>
                (a.range?.startOffset ?? 0) - (b.range?.startOffset ?? 0),
            )
            .map((ann) => {
              const top = positions.get(ann.id);
              return (
                <AnnotationCard
                  key={ann.id}
                  annotation={ann}
                  style={
                    top !== undefined
                      ? {
                          position: "absolute",
                          top: `${top}px`,
                          left: 0,
                          right: 0,
                        }
                      : { marginBottom: "4px" }
                  }
                />
              );
            })
        )}
      </div>
    </div>
  );
});
