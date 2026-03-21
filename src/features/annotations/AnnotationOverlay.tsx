import { memo, useEffect, useRef, useCallback } from "react";
import { useAnnotationStore, useSelectionStore } from "@/stores";
import type { Annotation } from "@/types";

type DocumentWithCaretApis = Document & {
  caretPositionFromPoint?: (
    x: number,
    y: number,
  ) => { offsetNode: Node | null; offset: number } | null;
  caretRangeFromPoint?: (x: number, y: number) => Range | null;
};

/**
 * AnnotationOverlay — CSS Highlight API non-destructive highlight layer.
 * Also detects mousemove to find which annotation is under the cursor,
 * enabling bidirectional hover interaction (document ↔ card).
 */
export const AnnotationOverlay = memo(function AnnotationOverlay({
  containerRef,
}: {
  containerRef: React.RefObject<HTMLElement | null>;
}) {
  const { annotations, hoveredAnnotationId } = useAnnotationStore();
  const { selection, showPopup } = useSelectionStore();
  const rafRef = useRef<number>(0);
  const textNodesCache = useRef<{ node: Text; start: number; end: number }[]>(
    [],
  );

  // Build text node index
  const buildTextNodes = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null,
    );
    const nodes: { node: Text; start: number; end: number }[] = [];
    let offset = 0;
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const textNode = node as Text;
      const len = textNode.textContent?.length ?? 0;
      nodes.push({ node: textNode, start: offset, end: offset + len });
      offset += len;
    }
    textNodesCache.current = nodes;
  }, [containerRef]);

  const applyHighlights = useCallback(() => {
    const container = containerRef.current;
    if (!container || !("Highlight" in window)) return;

    // Clear all existing annotation highlights
    CSS.highlights.delete("annotation-comment");
    CSS.highlights.delete("annotation-question");
    CSS.highlights.delete("annotation-rewrite");
    CSS.highlights.delete("annotation-challenge");
    CSS.highlights.delete("annotation-active");
    CSS.highlights.delete("annotation-creating");

    if (annotations.length === 0 && (!showPopup || !selection?.range)) return;

    buildTextNodes();
    const textNodes = textNodesCache.current;

    // Group ranges by kind
    const kindRanges: Record<string, Range[]> = {
      comment: [],
      question: [],
      rewrite: [],
      challenge: [],
    };
    const activeRanges: Range[] = [];
    const creatingRanges: Range[] =
      showPopup && selection?.range
        ? findRangesForAnnotation(
            textNodes,
            selection.range.startOffset,
            selection.range.endOffset,
          )
        : [];

    for (const ann of annotations) {
      if (!ann.range) continue;
      const ranges = findRangesForAnnotation(
        textNodes,
        ann.range.startOffset,
        ann.range.endOffset,
      );
      kindRanges[ann.kind].push(...ranges);

      if (ann.id === hoveredAnnotationId) {
        activeRanges.push(...ranges);
      }
    }

    // Apply highlights
    for (const [kind, ranges] of Object.entries(kindRanges)) {
      if (ranges.length > 0) {
        const highlight = new Highlight(...ranges);
        CSS.highlights.set(`annotation-${kind}`, highlight);
      }
    }

    if (activeRanges.length > 0) {
      const activeHighlight = new Highlight(...activeRanges);
      CSS.highlights.set("annotation-active", activeHighlight);
    }

    if (creatingRanges.length > 0) {
      const creatingHighlight = new Highlight(...creatingRanges);
      CSS.highlights.set("annotation-creating", creatingHighlight);
    }
  }, [
    containerRef,
    annotations,
    hoveredAnnotationId,
    buildTextNodes,
    showPopup,
    selection,
  ]);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(applyHighlights);
    return () => cancelAnimationFrame(rafRef.current);
  }, [applyHighlights]);

  // ─── Mousemove hover detection ──────────────────────────
  // Detect which annotation the cursor is over by checking caret position
  useEffect(() => {
    const container = containerRef.current;
    if (!container || annotations.length === 0) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Use caretPositionFromPoint or caretRangeFromPoint
      let charOffset: number | null = null;

      const doc = document as DocumentWithCaretApis;

      if (typeof doc.caretPositionFromPoint === "function") {
        // Firefox + modern browsers
        const pos = doc.caretPositionFromPoint(e.clientX, e.clientY);
        if (pos?.offsetNode) {
          const textNodes = textNodesCache.current;
          for (const tn of textNodes) {
            if (tn.node === pos.offsetNode) {
              charOffset = tn.start + pos.offset;
              break;
            }
          }
        }
      } else if (typeof doc.caretRangeFromPoint === "function") {
        // Chrome/Safari fallback
        const range = doc.caretRangeFromPoint(e.clientX, e.clientY);
        if (range) {
          const textNodes = textNodesCache.current;
          for (const tn of textNodes) {
            if (tn.node === range.startContainer) {
              charOffset = tn.start + range.startOffset;
              break;
            }
          }
        }
      }

      if (charOffset === null) {
        // Not over text
        const current = useAnnotationStore.getState().hoveredAnnotationId;
        if (current) useAnnotationStore.getState().setHoveredAnnotation(null);
        return;
      }

      // Find which annotation(s) contain this offset
      let found: string | null = null;
      for (const ann of annotations) {
        if (!ann.range) continue;
        if (
          charOffset >= ann.range.startOffset &&
          charOffset <= ann.range.endOffset
        ) {
          found = ann.id;
          break;
        }
      }

      const current = useAnnotationStore.getState().hoveredAnnotationId;
      if (found !== current) {
        useAnnotationStore.getState().setHoveredAnnotation(found);
      }
    };

    const handleMouseLeave = () => {
      useAnnotationStore.getState().setHoveredAnnotation(null);
    };

    container.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [containerRef, annotations]);

  return null;
});

/**
 * Find Range(s) for annotation based on text offsets.
 */
function findRangesForAnnotation(
  textNodes: { node: Text; start: number; end: number }[],
  startOffset: number,
  endOffset: number,
): Range[] {
  const ranges: Range[] = [];

  for (const { node, start, end } of textNodes) {
    if (end <= startOffset || start >= endOffset) continue;

    const range = document.createRange();
    const rangeStart = Math.max(0, startOffset - start);
    const rangeEnd = Math.min(node.textContent?.length ?? 0, endOffset - start);

    try {
      range.setStart(node, rangeStart);
      range.setEnd(node, rangeEnd);
      ranges.push(range);
    } catch {
      // Skip invalid ranges silently
    }
  }

  return ranges;
}

/**
 * Get the bounding rect of an annotation's highlighted text.
 */
export function getAnnotationRect(
  container: HTMLElement,
  ann: Annotation,
): DOMRect | null {
  if (!ann.range) return null;

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let offset = 0;
  let node: Node | null;

  while ((node = walker.nextNode())) {
    const textNode = node as Text;
    const len = textNode.textContent?.length ?? 0;
    const nodeEnd = offset + len;

    if (nodeEnd > ann.range.startOffset) {
      try {
        const range = document.createRange();
        const start = Math.max(0, ann.range.startOffset - offset);
        const end = Math.min(len, ann.range.endOffset - offset);
        range.setStart(textNode, start);
        range.setEnd(textNode, end);
        return range.getBoundingClientRect();
      } catch {
        return null;
      }
    }
    offset += len;
  }

  return null;
}
