import { memo, useState, useRef, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { useSelectionStore, useAnnotationStore, useUIStore } from "@/stores";
import type { AnnotationKind } from "@/types";
import { useT } from "@/lib/useT";
import { matchShortcut } from "@/lib/shortcuts";
import { createAnnotationFromSelection } from "./createAnnotation";

const KIND_OPTIONS: {
  value: AnnotationKind;
  labelKey: string;
  icon: string;
}[] = [
  { value: "comment", labelKey: "annPopup.comment", icon: "💬" },
  { value: "question", labelKey: "annPopup.question", icon: "❓" },
  { value: "rewrite", labelKey: "annPopup.rewrite", icon: "✏️" },
  { value: "challenge", labelKey: "annPopup.challenge", icon: "⚡" },
];

/**
 * AnnotationPopup — floating input form below selected/annotated text.
 * Supports both CREATE and EDIT modes.
 * - CREATE: selection is set, editingAnnotationId is null
 * - EDIT: editingAnnotationId is set (opens popup near the annotation's text)
 */
export const AnnotationPopup = memo(function AnnotationPopup() {
  const {
    selection,
    showPopup,
    popupKind,
    draftComment,
    setPopupKind,
    setDraftComment,
    closePopup,
  } = useSelectionStore();
  const {
    annotations,
    editingAnnotationId,
    addAnnotation,
    updateAnnotation,
    setEditingAnnotation,
  } = useAnnotationStore();
  const t = useT();
  const submitAnnotationShortcut = useUIStore((state) => state.shortcuts.submitAnnotation);

  const editingAnnotation = editingAnnotationId
    ? annotations.find((a) => a.id === editingAnnotationId) ?? null
    : null;

  const isEditMode = !!editingAnnotation;
  const isVisible = showPopup || isEditMode;

  const [comment, setComment] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const commentValue = isEditMode ? comment : draftComment;

  // Auto-focus and pre-fill when popup opens
  useEffect(() => {
    if (!isVisible) return;

    if (isEditMode && editingAnnotation) {
      setComment(editingAnnotation.comment);
      setPopupKind(editingAnnotation.kind);
    }

    const raf = requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.focus();
      if (isEditMode) textarea.select();
    });

    return () => cancelAnimationFrame(raf);
  }, [
    isVisible,
    isEditMode,
    editingAnnotation,
    selection?.range.startOffset,
    selection?.range.endOffset,
    setPopupKind,
  ]);

  // Reset on close
  useEffect(() => {
    if (!isVisible) setComment("");
  }, [isVisible]);

  // Clamp popup within parent container to prevent edge overflow
  useEffect(() => {
    if (!isVisible) return;
    const popup = popupRef.current;
    if (!popup) return;

    // Wait for layout to settle
    const raf = requestAnimationFrame(() => {
      const parent = popup.offsetParent as HTMLElement | null;
      if (!parent) return;

      const parentWidth = parent.clientWidth;
      const popupWidth = popup.offsetWidth;
      const currentLeft = popup.offsetLeft;

      // If popup overflows right edge, shift it left
      if (currentLeft + popupWidth > parentWidth) {
        const clampedLeft = Math.max(0, parentWidth - popupWidth - 8);
        popup.style.left = `${clampedLeft}px`;
      }
    });

    return () => cancelAnimationFrame(raf);
  });

  // Click-outside to close only in edit mode.
  // Create mode keeps the draft alive until the user closes explicitly.
  useEffect(() => {
    if (!isVisible || !isEditMode) return;

    const handler = (e: MouseEvent) => {
      const popup = popupRef.current;
      if (!popup) return;
      if (popup.contains(e.target as Node)) return;
      setEditingAnnotation(null);
    };

    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handler, true);
    }, 150);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handler, true);
    };
  }, [isVisible, isEditMode, setEditingAnnotation]);

  const handleClose = useCallback(() => {
    if (isEditMode) {
      setEditingAnnotation(null);
    } else {
      closePopup();
    }
  }, [isEditMode, setEditingAnnotation, closePopup]);

  const handleSubmit = useCallback(() => {
    const text = commentValue.trim();
    if (!text) return;

    if (isEditMode && editingAnnotation) {
      // EDIT mode — update the existing annotation
      const kind = useSelectionStore.getState().popupKind;
      updateAnnotation(editingAnnotation.id, { comment: text, kind });
      setEditingAnnotation(null);
    } else {
      // CREATE mode — add new annotation
      const sel = useSelectionStore.getState().selection;
      const kind = useSelectionStore.getState().popupKind;
      if (!sel) return;

      addAnnotation(createAnnotationFromSelection(sel, text, kind));
      closePopup();
      window.getSelection()?.removeAllRanges();
    }
  }, [
    commentValue,
    isEditMode,
    editingAnnotation,
    addAnnotation,
    updateAnnotation,
    closePopup,
    setEditingAnnotation,
  ]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (matchShortcut(e.nativeEvent, submitAnnotationShortcut)) {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      }
      e.stopPropagation();
    },
    [handleSubmit, handleClose, submitAnnotationShortcut],
  );

  if (!isVisible) return null;

  // Position: for edit mode, compute position from the annotation's
  // highlighted text in the document; for create mode, use selection rect.
  let posTop = 0;
  let posLeft = 0;

  if (isEditMode && editingAnnotation?.range) {
    // Find the annotation's DOM rect by walking text nodes
    const viewer = document.querySelector("[data-viewer-root]");
    if (viewer) {
      const rect = getAnnotationDomRect(viewer as HTMLElement, editingAnnotation.range.startOffset, editingAnnotation.range.endOffset);
      if (rect) {
        const viewerRect = viewer.getBoundingClientRect();
        const scrollContainer = viewer.closest("[data-scroll-container]");
        const scrollTop = scrollContainer?.scrollTop ?? 0;
        posTop = rect.bottom - viewerRect.top + scrollTop + 10;
        posLeft = Math.max(0, rect.left - viewerRect.left);
      }
    }
  } else if (selection) {
    posTop = selection.rect.bottom + 10;
    posLeft = Math.max(0, selection.rect.left);
  }

  return (
    <div
      ref={popupRef}
      className="absolute z-50"
      style={{
        top: `${posTop}px`,
        left: `${posLeft}px`,
        minWidth: "340px",
        maxWidth: "90vw",
        width: "max-content",
        fontFamily: "var(--font-sans)",
      }}
      onKeyDown={handleKeyDown}
      onMouseDown={(e) => e.stopPropagation()}
      data-testid="annotation-popup"
      data-mode={isEditMode ? "edit" : "create"}
    >
      <div
        style={{
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--color-border-subtle)",
          backgroundColor: "var(--color-surface-popover)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
          overflow: "hidden",
        }}
      >
        {/* Kind selector */}
        <div
          style={{
            display: "flex",
            flexWrap: "nowrap",
            gap: "2px",
            padding: "6px 10px",
            borderBottom: "1px solid var(--color-border-subtle)",
          }}
        >
          {KIND_OPTIONS.map((k) => (
            <button
              key={k.value}
              type="button"
              onClick={() => setPopupKind(k.value)}
              data-testid={`annotation-popup-kind-${k.value}`}
              style={{
                padding: "3px 8px",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.8rem",
                fontWeight: 500,
                fontFamily: "var(--font-sans)",
                cursor: "pointer",
                border: "none",
                whiteSpace: "nowrap",
                transition: "all 0.15s",
                backgroundColor:
                  popupKind === k.value
                    ? `var(--color-kind-${k.value}-bg)`
                    : "transparent",
                color:
                  popupKind === k.value
                    ? `var(--color-kind-${k.value}-text)`
                    : "var(--color-text-faint)",
              }}
            >
              {k.icon} {t(k.labelKey)}
            </button>
          ))}
        </div>

        {/* Textarea */}
        <div style={{ padding: "8px 10px" }}>
          <textarea
            ref={textareaRef}
            value={commentValue}
            onChange={(e) => {
              if (isEditMode) {
                setComment(e.target.value);
              } else {
                setDraftComment(e.target.value);
              }
            }}
            placeholder={isEditMode ? t("annPopup.editPlaceholder") : t("annPopup.addPlaceholder")}
            rows={3}
            data-testid="annotation-popup-textarea"
            style={{
              width: "100%",
              resize: "none",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-border-subtle)",
              backgroundColor: "var(--color-surface-card)",
              padding: "8px 10px",
              fontSize: "0.95rem",
              lineHeight: 1.5,
              fontFamily: "var(--font-sans)",
              color: "var(--color-text-primary)",
              outline: "none",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "var(--color-accent)";
              e.target.style.boxShadow =
                "0 0 0 2px var(--color-accent-glow)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "var(--color-border-subtle)";
              e.target.style.boxShadow = "none";
            }}
          />
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "6px 10px",
            borderTop: "1px solid var(--color-border-subtle)",
          }}
        >
          <span
            style={{
              fontSize: "0.75rem",
              color: "var(--color-text-faint)",
            }}
          >
            {submitAnnotationShortcut}
          </span>
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <button
              type="button"
              onClick={handleClose}
              data-testid="annotation-popup-cancel"
              style={{
                padding: "4px 10px",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.85rem",
                fontFamily: "var(--font-sans)",
                color: "var(--color-text-muted)",
                backgroundColor: "transparent",
                border: "none",
                cursor: "pointer",
                whiteSpace: "nowrap" as const,
              }}
            >
              {t("annPopup.cancel")}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSubmit();
              }}
              disabled={!commentValue.trim()}
              data-testid="annotation-popup-submit"
              style={{
                padding: "4px 12px",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.85rem",
                fontWeight: 500,
                fontFamily: "var(--font-sans)",
                color: "#fff",
                whiteSpace: "nowrap" as const,
                backgroundColor: commentValue.trim()
                  ? "var(--color-accent)"
                  : "var(--color-text-faint)",
                border: "none",
                cursor: commentValue.trim() ? "pointer" : "not-allowed",
                opacity: commentValue.trim() ? 1 : 0.5,
                transition: "all 0.15s",
              }}
            >
              {isEditMode ? t("annPopup.save") : t("annPopup.add")}
            </button>
          </div>
        </div>
      </div>

      {/* Close X */}
      <button
        type="button"
        onClick={handleClose}
        data-testid="annotation-popup-close"
        style={{
          position: "absolute",
          top: "-8px",
          right: "-8px",
          borderRadius: "50%",
          width: "18px",
          height: "18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "var(--color-surface-card)",
          border: "1px solid var(--color-border-subtle)",
          color: "var(--color-text-faint)",
          cursor: "pointer",
          boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
        }}
      >
        <X style={{ width: "10px", height: "10px" }} />
      </button>
    </div>
  );
});

/**
 * Walk text nodes in a container to build a DOM range for a given
 * character offset range, returns its bounding rect.
 */
function getAnnotationDomRect(
  container: HTMLElement,
  startOffset: number,
  endOffset: number,
): DOMRect | null {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let pos = 0;
  let startNode: Text | null = null;
  let startOff = 0;
  let endNode: Text | null = null;
  let endOff = 0;

  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const len = node.length;

    if (!startNode && pos + len > startOffset) {
      startNode = node;
      startOff = startOffset - pos;
    }
    if (pos + len >= endOffset) {
      endNode = node;
      endOff = endOffset - pos;
      break;
    }
    pos += len;
  }

  if (!startNode || !endNode) return null;

  try {
    const range = document.createRange();
    range.setStart(startNode, startOff);
    range.setEnd(endNode, Math.min(endOff, endNode.length));
    return range.getBoundingClientRect();
  } catch {
    return null;
  }
}
