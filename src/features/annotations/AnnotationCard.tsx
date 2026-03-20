import { memo } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useAnnotationStore } from "@/stores";
import type { Annotation, AnnotationKind } from "@/types";
import { useT } from "@/lib/useT";

const KIND_COLORS: Record<AnnotationKind, string> = {
  comment: "#3b82f6",
  question: "#f59e0b",
  rewrite: "#10b981",
  challenge: "#ef4444",
};

/**
 * AnnotationCard — compact read-only card in the right margin.
 * Edit opens the floating popup (like creation).
 * Delete removes the annotation directly.
 */
export const AnnotationCard = memo(function AnnotationCard({
  annotation,
  style,
}: {
  annotation: Annotation;
  style?: React.CSSProperties;
}) {
  const {
    hoveredAnnotationId,
    setHoveredAnnotation,
    setEditingAnnotation,
    removeAnnotation,
  } = useAnnotationStore();
  const t = useT();

  const isHovered = hoveredAnnotationId === annotation.id;
  const kindColor = KIND_COLORS[annotation.kind];

  return (
    <div
      data-annotation-id={annotation.id}
      data-testid="annotation-card"
      onMouseEnter={() => setHoveredAnnotation(annotation.id)}
      onMouseLeave={() => setHoveredAnnotation(null)}
      style={{
        ...style,
        borderLeft: `3px solid ${kindColor}`,
        padding: "8px 10px",
        fontSize: "0.95rem",
        fontFamily: "var(--font-sans)",
        transition: "background 0.15s, box-shadow 0.15s",
        backgroundColor: isHovered
          ? "var(--color-surface-hover)"
          : "var(--color-surface-card)",
        borderRadius: "0 6px 6px 0",
        boxShadow: isHovered
          ? "0 2px 8px rgba(0,0,0,0.12)"
          : "0 1px 3px rgba(0,0,0,0.06)",
        cursor: "default",
      }}
    >
      {/* Comment text */}
      <p
        style={{
          margin: 0,
          fontSize: "0.95rem",
          lineHeight: 1.5,
          color: "var(--color-text-primary)",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {annotation.comment}
      </p>

      {/* Footer: time + actions */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: "6px",
        }}
      >
        <span
          style={{
            fontSize: "0.8rem",
            color: "var(--color-text-secondary)",
          }}
        >
          {formatRelativeTime(annotation.createdAt, t)}
        </span>
        <div style={{ display: "flex", gap: "2px" }}>
          <button
            type="button"
            onClick={() => setEditingAnnotation(annotation.id)}
            title={t("ann.editTitle")}
            data-testid="annotation-card-edit"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "3px",
              padding: "2px 6px",
              borderRadius: "4px",
              border: "none",
              backgroundColor: "transparent",
              color: "var(--color-text-secondary)",
              cursor: "pointer",
              fontSize: "0.8rem",
              fontFamily: "var(--font-sans)",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--color-surface-hover)";
              e.currentTarget.style.color = kindColor;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "var(--color-text-secondary)";
            }}
          >
            <Pencil style={{ width: "12px", height: "12px" }} />
            {t("ann.edit")}
          </button>
          <button
            type="button"
            onClick={() => removeAnnotation(annotation.id)}
            title={t("ann.deleteTitle")}
            data-testid="annotation-card-delete"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "3px",
              padding: "2px 6px",
              borderRadius: "4px",
              border: "none",
              backgroundColor: "transparent",
              color: "var(--color-text-secondary)",
              cursor: "pointer",
              fontSize: "0.8rem",
              fontFamily: "var(--font-sans)",
              transition: "all 0.15s",
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
            <Trash2 style={{ width: "12px", height: "12px" }} />
            {t("ann.delete")}
          </button>
        </div>
      </div>
    </div>
  );
});

function formatRelativeTime(isoString: string, t: (key: string, n?: number | string) => string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return t("time.justNow");
  if (mins < 60) return t("time.minutesAgo", mins);
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("time.hoursAgo", hours);
  return t("time.daysAgo", Math.floor(hours / 24));
}
