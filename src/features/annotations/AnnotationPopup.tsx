import { memo, useState, useRef, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { useSelectionStore, useAnnotationStore } from "@/stores";
import type { AnnotationKind } from "@/types";
import { useT } from "@/lib/useT";

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
  const { selection, showPopup, popupKind, setPopupKind, closePopup } =
    useSelectionStore();
  const {
    annotations,
    editingAnnotationId,
    addAnnotation,
    updateAnnotation,
    setEditingAnnotation,
  } = useAnnotationStore();
  const t = useT();

  const editingAnnotation = editingAnnotationId
    ? annotations.find((a) => a.id === editingAnnotationId) ?? null
    : null;

  const isEditMode = !!editingAnnotation;
  const isVisible = showPopup || isEditMode;

  const [comment, setComment] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // Auto-focus and pre-fill when popup opens
  useEffect(() => {
    if (isVisible) {
      if (isEditMode && editingAnnotation) {
        setComment(editingAnnotation.comment);
        setPopupKind(editingAnnotation.kind);
      }
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
        if (isEditMode) textareaRef.current?.select();
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [isVisible, isEditMode, editingAnnotation, setPopupKind]);

  // Reset on close
  useEffect(() => {
    if (!isVisible) setComment("");
  }, [isVisible]);

  // Click-outside to close
  useEffect(() => {
    if (!isVisible) return;

    const handler = (e: MouseEvent) => {
      const popup = popupRef.current;
      if (!popup) return;
      if (popup.contains(e.target as Node)) return;
      if (isEditMode) {
        setEditingAnnotation(null);
      } else {
        closePopup();
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handler, true);
    }, 150);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handler, true);
    };
  }, [isVisible, isEditMode, closePopup, setEditingAnnotation]);

  const handleClose = useCallback(() => {
    if (isEditMode) {
      setEditingAnnotation(null);
    } else {
      closePopup();
    }
  }, [isEditMode, setEditingAnnotation, closePopup]);

  const handleSubmit = useCallback(() => {
    const text = comment.trim();
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

      addAnnotation({
        id: crypto.randomUUID(),
        documentId: "default",
        quote: sel.quote,
        comment: text,
        range: sel.range,
        kind: kind,
        status: "open",
        createdAt: new Date().toISOString(),
      });

      setComment("");
      closePopup();
      window.getSelection()?.removeAllRanges();
    }
  }, [
    comment,
    isEditMode,
    editingAnnotation,
    addAnnotation,
    updateAnnotation,
    closePopup,
    setEditingAnnotation,
  ]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      }
      e.stopPropagation();
    },
    [handleSubmit, handleClose],
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
        width: "340px",
        fontFamily: "var(--font-sans)",
      }}
      onKeyDown={handleKeyDown}
      onMouseDown={(e) => e.stopPropagation()}
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
              style={{
                padding: "3px 8px",
                borderRadius: "var(--radius-sm)",
                fontSize: "11px",
                fontWeight: 500,
                fontFamily: "var(--font-sans)",
                cursor: "pointer",
                border: "none",
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
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={isEditMode ? t("annPopup.editPlaceholder") : t("annPopup.addPlaceholder")}
            rows={3}
            style={{
              width: "100%",
              resize: "none",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-border-subtle)",
              backgroundColor: "var(--color-surface-card)",
              padding: "8px 10px",
              fontSize: "13px",
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
              fontSize: "10px",
              color: "var(--color-text-faint)",
            }}
          >
            {t("annPopup.submitHint")}
          </span>
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <button
              type="button"
              onClick={handleClose}
              style={{
                padding: "4px 10px",
                borderRadius: "var(--radius-sm)",
                fontSize: "12px",
                fontFamily: "var(--font-sans)",
                color: "var(--color-text-muted)",
                backgroundColor: "transparent",
                border: "none",
                cursor: "pointer",
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
              disabled={!comment.trim()}
              style={{
                padding: "4px 12px",
                borderRadius: "var(--radius-sm)",
                fontSize: "12px",
                fontWeight: 500,
                fontFamily: "var(--font-sans)",
                color: "#fff",
                backgroundColor: comment.trim()
                  ? "var(--color-accent)"
                  : "var(--color-text-faint)",
                border: "none",
                cursor: comment.trim() ? "pointer" : "not-allowed",
                opacity: comment.trim() ? 1 : 0.5,
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
