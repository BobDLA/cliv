import { memo, useMemo, useCallback, useState, useEffect, useRef } from "react";
import {
  Check,
  Copy,
  CheckSquare,
  Square,
  Send,
  ChevronUp,
  ChevronDown,
  Repeat,
  MessageSquare,
  LogOut,
} from "lucide-react";
import { useAnnotationStore, useReturnStore, useDocumentStore } from "@/stores";
import { writeBack, closeWindow } from "@/services/writeBack";
import { useT } from "@/lib/useT";
import { messages, type Locale, detectContentLocale } from "@/lib/locales";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export type TemplateMode = "reply" | "iterate";

const TEMPLATE_LABELS: Record<TemplateMode, { labelKey: string; descKey: string }> = {
  reply: { labelKey: "return.replyMode", descKey: "return.replyDesc" },
  iterate: { labelKey: "return.iterateMode", descKey: "return.iterateDesc" },
};

const TEMPLATE_HEADER_KEYS: Record<TemplateMode, string> = {
  reply: "prompt.replyHeader",
  iterate: "prompt.iterateHeader",
};

const PROMPT_KIND_KEYS: Record<string, string> = {
  comment: "prompt.kindComment",
  question: "prompt.kindQuestion",
  rewrite: "prompt.kindRewrite",
  challenge: "prompt.kindChallenge",
};

/** Resolve i18n key for given locale */
function tl(locale: Locale, key: string, n?: number | string): string {
  const str = messages[locale]?.[key] ?? messages.en?.[key] ?? key;
  if (n !== undefined) return str.replace("{n}", String(n));
  return str;
}

function getLineRange(text: string, startOffset?: number, endOffset?: number): [number, number] | null {
  if (startOffset == null || endOffset == null || !text) return null;
  const prefix = text.slice(0, startOffset);
  const startLine = (prefix.match(/\n/g) || []).length + 1;
  const selection = text.slice(startOffset, endOffset);
  const lineCount = (selection.match(/\n/g) || []).length;
  return [startLine, startLine + lineCount];
}

/**
 * ReturnBuilder — bottom split panel.
 * Left: user custom editing area (global comments, free-form text).
 * Right: aggregated annotations with checkboxes.
 * Template selector + submit button.
 */
export const ReturnBuilder = memo(function ReturnBuilder() {
  const annotations = useAnnotationStore((s) => s.annotations);
  const { selectedAnnotationIds, selectAll, deselectAll, toggleSelect } =
    useReturnStore();
  const composePath = useDocumentStore((s) => s.composePath);
  const composeContent = useDocumentStore((s) => s.composeContent);
  const t = useT();

  // Content locale dynamically detected from selected annotations
  const contentLocale = useMemo(() => {
    const combinedText = annotations.map(a => a.quote + " " + a.comment).join("\n");
    return detectContentLocale(combinedText);
  }, [annotations]);

  const [userText, setUserText] = useState(tl(contentLocale, TEMPLATE_HEADER_KEYS["reply"]));
  const [templateMode, setTemplateMode] = useState<TemplateMode>("reply");

  // Switch template → insert default text into editor (based on contentLocale)
  const handleSetTemplate = useCallback((mode: TemplateMode) => {
    setTemplateMode(mode);
    setUserText(tl(contentLocale, TEMPLATE_HEADER_KEYS[mode]));
  }, [contentLocale]);

  // Auto-select all annotations on mount and when annotations change
  useEffect(() => {
    if (annotations.length > 0) {
      selectAll(annotations.map((a) => a.id));
    }
  }, [annotations, selectAll]);

  // ── Vertical resize (drag top edge up/down) ──
  const [panelHeight, setPanelHeight] = useState(220);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);

  const onVDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startY: e.clientY, startH: panelHeight };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const delta = dragRef.current.startY - ev.clientY;
      setPanelHeight(Math.max(120, Math.min(600, dragRef.current.startH + delta)));
    };
    const onUp = () => {
      dragRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [panelHeight]);

  // ── Horizontal splitter (drag left/right divider) ──
  const [splitRatio, setSplitRatio] = useState(0.5);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const hDragRef = useRef<{ startX: number; startRatio: number } | null>(null);

  const onHDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    hDragRef.current = { startX: e.clientX, startRatio: splitRatio };
    const onMove = (ev: MouseEvent) => {
      if (!hDragRef.current || !splitContainerRef.current) return;
      const containerW = splitContainerRef.current.offsetWidth;
      if (containerW === 0) return;
      const deltaX = ev.clientX - hDragRef.current.startX;
      const deltaRatio = deltaX / containerW;
      setSplitRatio(Math.max(0.2, Math.min(0.8, hDragRef.current.startRatio + deltaRatio)));
    };
    const onUp = () => {
      hDragRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [splitRatio]);
  const [copySuccess, setCopySuccess] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  // Selected annotations sorted by document position
  const selectedAnns = useMemo(() => {
    return [...annotations]
      .filter((a) => selectedAnnotationIds.has(a.id))
      .sort(
        (a, b) => (a.range?.startOffset ?? 0) - (b.range?.startOffset ?? 0),
      );
  }, [annotations, selectedAnnotationIds]);

  // Build right-side aggregated prompt with structured format
  const annotationPrompt = useMemo(() => {
    if (selectedAnns.length === 0) return "";
    const items = selectedAnns.map((ann, i) => {
      const kindKey = PROMPT_KIND_KEYS[ann.kind] ?? ann.kind;
      const kind = tl(contentLocale, kindKey);
      
      let linesInfo = "";
      if (composeContent && ann.range) {
        const lines = getLineRange(composeContent, ann.range.startOffset, ann.range.endOffset);
        if (lines) {
          if (lines[0] === lines[1]) {
            linesInfo = tl(contentLocale, "prompt.lineNumber", lines[0]);
          } else {
            linesInfo = tl(contentLocale, "prompt.lineRange", `${lines[0]}-${lines[1]}`);
          }
        }
      }

      const formattedQuote = ann.quote.trim().split('\n').join('\n> ');

      return [
        `## ${tl(contentLocale, "prompt.annotationHeading", i + 1)}`,
        "",
        `**${tl(contentLocale, "prompt.type")}**: ${kind}`,
        "",
        `**${tl(contentLocale, "prompt.originalText")}**${linesInfo}:`,
        `> ${formattedQuote}`,
        "",
        `**${tl(contentLocale, "prompt.comment")}**:`,
        ann.comment.trim(),
      ].join("\n");
    });
    return items.join("\n\n---\n\n");
  }, [selectedAnns, contentLocale, composeContent]);

  // Final combined output = user text + annotations
  const finalOutput = useMemo(() => {
    const parts: string[] = [];
    if (userText.trim()) parts.push(userText.trim());
    if (annotationPrompt) parts.push(annotationPrompt);
    return parts.join("\n\n---\n\n");
  }, [userText, annotationPrompt]);

  const allSelected =
    annotations.length > 0 &&
    annotations.every((a) => selectedAnnotationIds.has(a.id));
  const hasContent = finalOutput.trim().length > 0;

  const handleToggleAll = useCallback(() => {
    if (allSelected) deselectAll();
    else selectAll(annotations.map((a) => a.id));
  }, [allSelected, annotations, selectAll, deselectAll]);

  const handleSubmit = useCallback(async () => {
    if (!hasContent) return;
    try {
      setWriteError(null);
      const method = await writeBack(finalOutput, composePath);
      if (method === "written") {
        setCopySuccess(true);
        // Auto-close window after successful file write-back (Codex flow)
        setTimeout(() => closeWindow(), 800);
      } else {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2500);
      }
    } catch (e) {
      setWriteError(e instanceof Error ? e.message : t("return.writeFail"));
    }
  }, [finalOutput, composePath, hasContent]);

  return (
    <div
      style={{
        backgroundColor: "var(--color-surface-main)",
        fontFamily: "var(--font-sans)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
      }}
    >
      {/* ── Vertical resize handle (top border) ── */}
      <div
        onMouseDown={onVDragStart}
        style={{
          height: "6px",
          cursor: "ns-resize",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: "100%",
            height: "1px",
            backgroundColor: "var(--color-border-subtle)",
            transition: "height 0.1s",
          }}
          onMouseEnter={(e) => e.currentTarget.style.height = "2px"}
          onMouseLeave={(e) => e.currentTarget.style.height = "1px"}
        />
      </div>

      {/* ── Header bar ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 12px",
          borderBottom: collapsed
            ? "none"
            : "1px solid var(--color-border-subtle)",
          cursor: "pointer",
        }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Send
            style={{
              width: "14px",
              height: "14px",
              color: "var(--color-accent)",
            }}
          />
          <span
            style={{
              fontSize: "1rem",
              fontWeight: 600,
              color: "var(--color-text-primary)",
            }}
          >
            {t("return.outputEditor")}
          </span>
          {selectedAnns.length > 0 && (
            <span
              style={{
                fontSize: "0.85rem",
                padding: "1px 6px",
                borderRadius: "9999px",
                backgroundColor: "var(--color-accent)",
                color: "#fff",
                fontWeight: 500,
              }}
            >
              {selectedAnns.length} {t("return.annotationCount", selectedAnns.length).replace(String(selectedAnns.length) + " ", "")}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {/* Template mode selector */}
          <div
            style={{ display: "flex", gap: "2px" }}
            onClick={(e) => e.stopPropagation()}
          >
            {(Object.keys(TEMPLATE_LABELS) as TemplateMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => handleSetTemplate(mode)}
                title={t(TEMPLATE_LABELS[mode].descKey)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "3px 8px",
                  borderRadius: "4px",
                  border: "none",
                  fontSize: "0.85rem",
                  fontFamily: "var(--font-sans)",
                  cursor: "pointer",
                  transition: "all 0.12s",
                  backgroundColor:
                    templateMode === mode
                      ? "#3b82f6"
                      : "transparent",
                  color:
                    templateMode === mode
                      ? "#fff"
                      : "var(--color-text-secondary)",
                }}
              >
                {TEMPLATE_LABELS[mode].labelKey === "return.replyMode" ? (
                  <MessageSquare
                    style={{ width: "11px", height: "11px" }}
                  />
                ) : (
                  <Repeat style={{ width: "11px", height: "11px" }} />
                )}
                {t(TEMPLATE_LABELS[mode].labelKey)}
              </button>
            ))}
          </div>
          {collapsed ? (
            <ChevronUp
              style={{
                width: "14px",
                height: "14px",
                color: "var(--color-text-faint)",
              }}
            />
          ) : (
            <ChevronDown
              style={{
                width: "14px",
                height: "14px",
                color: "var(--color-text-faint)",
              }}
            />
          )}
        </div>
      </div>


      {/* ── Body: split left/right ── */}
      {!collapsed && (
        <div
          ref={splitContainerRef}
          style={{
            display: "flex",
            height: `${panelHeight}px`,
            overflow: "hidden",
          }}
        >
          {/* LEFT: user custom editor */}
          <div
            style={{
              width: `${splitRatio * 100}%`,
              display: "flex",
              flexDirection: "column",
              minWidth: 0,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                padding: "4px 10px",
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "var(--color-text-secondary)",
                borderBottom: "1px solid var(--color-border-subtle)",
                flexShrink: 0,
              }}
            >
              {t("return.freeEdit")}
            </div>
            <textarea
              value={userText}
              onChange={(e) => setUserText(e.target.value)}
              placeholder={t("return.freeEditPlaceholder")}
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                resize: "none",
                padding: "8px 14px",
                fontSize: "0.95rem",
                lineHeight: 1.6,
                fontFamily: "var(--font-sans)",
                color: "var(--color-text-primary)",
                backgroundColor: "transparent",
              }}
            />
          </div>

          {/* Horizontal drag handle with padding */}
          <div
            onMouseDown={onHDragStart}
            style={{
              width: "1px",
              cursor: "col-resize",
              backgroundColor: "var(--color-border-subtle)",
              flexShrink: 0,
              margin: "0 8px",
              transition: "width 0.1s, margin 0.1s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.width = "2px"; }}
            onMouseLeave={(e) => { e.currentTarget.style.width = "1px"; }}
          />

          {/* RIGHT: aggregated annotations */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              minWidth: 0,
            }}
          >
            <div
              style={{
                padding: "4px 10px",
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "var(--color-text-secondary)",
                borderBottom: "1px solid var(--color-border-subtle)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              <span>{t("return.aggregatePreview")}</span>
              {annotations.length > 0 && (
                <button
                  type="button"
                  onClick={handleToggleAll}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "3px",
                    padding: "1px 6px",
                    borderRadius: "3px",
                    border: "none",
                    backgroundColor: "transparent",
                    color: "var(--color-text-secondary)",
                    cursor: "pointer",
                    fontSize: "0.8rem",
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  {allSelected ? (
                    <CheckSquare style={{ width: "11px", height: "11px" }} />
                  ) : (
                    <Square style={{ width: "11px", height: "11px" }} />
                  )}
                  {allSelected ? t("return.deselectAll") : t("return.selectAll")}
                </button>
              )}
            </div>

            {annotations.length === 0 ? (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--color-text-faint)",
                  fontSize: "0.9rem",
                }}
              >
                {t("return.noAnnotations")}
              </div>
            ) : (
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "4px 6px",
                }}
              >
                {[...annotations]
                  .sort(
                    (a, b) =>
                      (a.range?.startOffset ?? 0) -
                      (b.range?.startOffset ?? 0),
                  )
                  .map((ann) => {
                    const isSelected = selectedAnnotationIds.has(ann.id);
                    return (
                      <label
                        key={ann.id}
                        style={{
                          display: "flex",
                          gap: "6px",
                          alignItems: "flex-start",
                          padding: "4px 4px",
                          borderRadius: "4px",
                          cursor: "pointer",
                          transition: "background 0.1s",
                          backgroundColor: isSelected
                            ? "var(--color-surface-hover)"
                            : "transparent",
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected)
                            e.currentTarget.style.backgroundColor =
                              "var(--color-surface-hover)";
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected)
                            e.currentTarget.style.backgroundColor =
                              "transparent";
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(ann.id)}
                          style={{
                            accentColor: "var(--color-accent)",
                            marginTop: "2px",
                            cursor: "pointer",
                            flexShrink: 0,
                          }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: "0.85rem",
                              fontWeight: 600,
                              color: "var(--color-accent)",
                              marginBottom: "2px",
                            }}
                          >
                          #{tl(contentLocale, PROMPT_KIND_KEYS[ann.kind] ?? ann.kind)}
                          </div>
                          <div
                            style={{
                              fontSize: "0.85rem",
                              color: "var(--color-text-secondary)",
                              lineHeight: 1.4,
                              marginBottom: "2px",
                            }}
                          >
                            {tl(contentLocale, "prompt.originalText")}: {ann.quote}
                          </div>
                          <div
                            style={{
                              fontSize: "0.95rem",
                              color: "var(--color-text-primary)",
                              lineHeight: 1.4,
                            }}
                          >
                            {tl(contentLocale, "prompt.comment")}: {ann.comment}
                          </div>
                        </div>
                      </label>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Footer: status + submit ── */}
      {!collapsed && (
        <div
          style={{
            padding: "6px 12px",
            borderTop: "1px solid var(--color-border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flex: 1,
            }}
          >
            {writeError && (
              <span style={{ fontSize: "0.85rem", color: "#ef4444" }}>
                {writeError}
              </span>
            )}
            {copySuccess && (
              <span
                style={{
                  fontSize: "0.85rem",
                  color: "#10b981",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <Check style={{ width: "12px", height: "12px" }} />
                {t("return.copied")}
              </span>
            )}
            {!writeError && !copySuccess && (
              <span
                style={{
                  fontSize: "0.85rem",
                  color: "var(--color-text-secondary)",
                }}
              >
                {templateMode === "reply" ? t("return.replyModeStatus") : t("return.iterateModeStatus")}
                {selectedAnns.length > 0 &&
                  t("return.selectedCount", selectedAnns.length)}
              </span>
            )}
          </div>
          <button
            type="button"
            disabled={!hasContent}
            onClick={handleSubmit}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 16px",
              borderRadius: "6px",
              border: "none",
              backgroundColor: hasContent
                ? composePath && isTauri ? "#10b981" : "#3b82f6"
                : "var(--color-text-faint)",
              color: "#fff",
              fontSize: "0.9rem",
              fontWeight: 600,
              fontFamily: "var(--font-sans)",
              cursor: hasContent ? "pointer" : "not-allowed",
              opacity: hasContent ? 1 : 0.5,
              transition: "all 0.15s",
            }}
          >
            {composePath && isTauri ? (
              <><LogOut style={{ width: "13px", height: "13px" }} />{t("return.writeBackClose")}</>
            ) : (
              <><Copy style={{ width: "13px", height: "13px" }} />{t("return.copySubmit")}</>
            )}
          </button>
        </div>
      )}
    </div>
  );
});
