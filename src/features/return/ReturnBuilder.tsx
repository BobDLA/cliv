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
import {
  useAnnotationStore,
  useConfigStore,
  useHistoryStore,
  useReturnStore,
  useDocumentStore,
  useUIStore,
} from "@/stores";
import { saveReviewArchive } from "@/services/historyService";
import { writeBack, closeWindow } from "@/services/writeBack";
import { useT } from "@/lib/useT";
import { messages, type Locale, detectContentLocale } from "@/lib/locales";
import { resolveWorkspacePath } from "@/lib/pathUtils";
import { resolvePromptHeader } from "@/lib/promptTemplates";
import { matchShortcut } from "@/lib/shortcuts";
import type { PromptConfig } from "@/types";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export type TemplateMode = "reply" | "iterate";

const TEMPLATE_LABELS: Record<TemplateMode, { labelKey: string; descKey: string }> = {
  reply: { labelKey: "return.replyMode", descKey: "return.replyDesc" },
  iterate: { labelKey: "return.iterateMode", descKey: "return.iterateDesc" },
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

const HEADER_SOURCE_LOCALES: readonly Locale[] = ["en", "zh"];
const HEADER_SOURCE_MODES: readonly TemplateMode[] = ["reply", "iterate"];

function getLineRange(text: string, startOffset?: number, endOffset?: number): [number, number] | null {
  if (startOffset == null || endOffset == null || !text) return null;
  const prefix = text.slice(0, startOffset);
  const startLine = (prefix.match(/\n/g) || []).length + 1;
  const selection = text.slice(startOffset, endOffset);
  const lineCount = (selection.match(/\n/g) || []).length;
  return [startLine, startLine + lineCount];
}

function resolveUserTextSeed(
  locale: Locale,
  mode: TemplateMode,
  promptConfig: PromptConfig | null,
  targetContent?: string | null,
): string {
  const header = resolvePromptHeader(locale, mode, promptConfig).trim();
  const existingTargetText = stripLeadingPromptHeader(targetContent, promptConfig);

  if (!existingTargetText) return header;

  return `${header}\n\n${existingTargetText}`;
}

function stripLeadingPromptHeader(
  targetContent: string | null | undefined,
  promptConfig: PromptConfig | null,
): string {
  const existingTargetText = targetContent?.trim();
  if (!existingTargetText) return "";

  const knownHeaders = new Set<string>();
  for (const locale of HEADER_SOURCE_LOCALES) {
    for (const mode of HEADER_SOURCE_MODES) {
      const header = resolvePromptHeader(locale, mode, promptConfig).trim();
      if (header) knownHeaders.add(header);
    }
  }

  for (const header of knownHeaders) {
    if (existingTargetText === header) return "";
    if (existingTargetText.startsWith(header)) {
      return existingTargetText.slice(header.length).trimStart();
    }
  }

  return existingTargetText;
}

function normalizeTemplateMode(mode: string | null | undefined): TemplateMode {
  return mode === "iterate" ? "iterate" : "reply";
}

function clearTimeoutRef(ref: { current: number | null }) {
  if (ref.current == null) return;
  window.clearTimeout(ref.current);
  ref.current = null;
}

/**
 * ReturnBuilder — bottom split panel.
 * Left: user custom editing area (global comments, free-form text).
 * Right: aggregated annotations with checkboxes.
 * Template selector + submit button.
 */
export const ReturnBuilder = memo(function ReturnBuilder() {
  const annotations = useAnnotationStore((s) => s.annotations);
  const promptConfig = useConfigStore((s) => s.promptConfig);
  const { selectedAnnotationIds, selectAll, deselectAll, toggleSelect } =
    useReturnStore();
  const documentId = useDocumentStore((s) => s.documentId);
  const targetPath = useDocumentStore((s) => s.targetPath);
  const targetContent = useDocumentStore((s) => s.targetContent);
  const replyContent = useDocumentStore((s) => s.replyContent);
  const reviewPath = useDocumentStore((s) => s.reviewPath);
  const replyPath = useDocumentStore((s) => s.replyPath);
  const workspacePath = useDocumentStore((s) => s.workspacePath);
  const archivedSubmission = useDocumentStore((s) => s.archivedSubmission);
  const isReadOnly = useDocumentStore((s) => s.isReadOnly);
  const t = useT();
  const uiLocale = useUIStore((s) => s.locale);
  const submitReturnShortcut = useUIStore((s) => s.shortcuts.submitReturn);

  // Content locale dynamically detected from selected annotations
  const contentLocale = useMemo(() => {
    const combinedText = annotations.map(a => a.quote + " " + a.comment).join("\n");
    if (!combinedText) return uiLocale;
    return detectContentLocale(combinedText);
  }, [annotations, uiLocale]);

  const [templateMode, setTemplateMode] = useState<TemplateMode>("reply");
  const userTextSeed = useMemo(
    () => resolveUserTextSeed(contentLocale, templateMode, promptConfig, targetContent),
    [contentLocale, promptConfig, targetContent, templateMode],
  );
  const [userText, setUserText] = useState(userTextSeed);
  const previousDocumentIdRef = useRef(documentId);
  const previousUserTextSeedRef = useRef(userTextSeed);

  // Keep the editor seeded from the current target on first load or document switch.
  // Locale/template updates only apply automatically while the user is still on the seed text.
  useEffect(() => {
    const documentChanged = previousDocumentIdRef.current !== documentId;
    const previousSeed = previousUserTextSeedRef.current;
    const nextSeed =
      isReadOnly && archivedSubmission
        ? archivedSubmission.userText
        : userTextSeed;

    previousDocumentIdRef.current = documentId;
    previousUserTextSeedRef.current = nextSeed;

    if (isReadOnly && archivedSubmission) {
      setTemplateMode(normalizeTemplateMode(archivedSubmission.templateMode));
    }

    setUserText((prev) => {
      if (documentChanged || prev === previousSeed) {
        return nextSeed;
      }
      return prev;
    });
  }, [archivedSubmission, documentId, isReadOnly, userTextSeed]);

  // Switch template → reseed editor from the current target content
  const handleSetTemplate = useCallback((mode: TemplateMode) => {
    if (isReadOnly) return;
    setTemplateMode(mode);
    setUserText(resolveUserTextSeed(contentLocale, mode, promptConfig, targetContent));
  }, [contentLocale, isReadOnly, promptConfig, targetContent]);

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
  const [submitSuccessMethod, setSubmitSuccessMethod] = useState<"written" | "clipboard" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitLocked, setSubmitLocked] = useState(false);
  const [lastSubmittedFingerprint, setLastSubmittedFingerprint] = useState<string | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const submitLockedRef = useRef(false);
  const closeWindowTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    clearTimeoutRef(closeWindowTimeoutRef);
    submitLockedRef.current = false;
    setSubmitSuccessMethod(null);
    setLastSubmittedFingerprint(null);
    setIsSubmitting(false);
    setSubmitLocked(false);
    setWriteError(null);
  }, [documentId]);

  useEffect(() => {
    return () => {
      clearTimeoutRef(closeWindowTimeoutRef);
    };
  }, []);

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
      if (replyContent && ann.range) {
        const lines = getLineRange(replyContent, ann.range.startOffset, ann.range.endOffset);
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
  }, [selectedAnns, contentLocale, replyContent]);

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
  const freeInputAddsItem =
    userText.trim().length > 0 && userText.trim() !== userTextSeed.trim();
  const itemCount = hasContent
    ? Math.max(selectedAnns.length + (freeInputAddsItem ? 1 : 0), 1)
    : 0;
  const effectiveWorkspacePath = useMemo(
    () =>
      resolveWorkspacePath({
        workspacePath,
        reviewPath,
        replyPath,
        targetPath,
      }),
    [workspacePath, reviewPath, replyPath, targetPath],
  );
  const submissionFingerprint = useMemo(
    () =>
      JSON.stringify({
        documentId,
        targetPath: targetPath ?? "",
        reviewPath: reviewPath ?? "",
        replyPath: replyPath ?? "",
        workspacePath: effectiveWorkspacePath ?? "",
        templateMode,
        finalOutput,
        replyContent: replyContent ?? "",
        targetBefore: targetContent ?? "",
        itemCount,
      }),
    [
      documentId,
      effectiveWorkspacePath,
      finalOutput,
      itemCount,
      replyContent,
      replyPath,
      reviewPath,
      targetContent,
      targetPath,
      templateMode,
    ],
  );
  const hasSubmittedCurrentOutput =
    lastSubmittedFingerprint !== null &&
    lastSubmittedFingerprint === submissionFingerprint;

  useEffect(() => {
    if (
      !isSubmitting &&
      lastSubmittedFingerprint !== null &&
      !hasSubmittedCurrentOutput
    ) {
      setSubmitSuccessMethod(null);
    }
  }, [hasSubmittedCurrentOutput, isSubmitting, lastSubmittedFingerprint]);

  const handleToggleAll = useCallback(() => {
    if (isReadOnly) return;
    if (allSelected) deselectAll();
    else selectAll(annotations.map((a) => a.id));
  }, [allSelected, annotations, deselectAll, isReadOnly, selectAll]);

  const handleSubmit = useCallback(async () => {
    if (
      !hasContent ||
      isReadOnly ||
      submitLockedRef.current ||
      hasSubmittedCurrentOutput
    ) {
      return;
    }

    clearTimeoutRef(closeWindowTimeoutRef);
    submitLockedRef.current = true;
    setIsSubmitting(true);
    setSubmitLocked(true);
    setSubmitSuccessMethod(null);

    try {
      setWriteError(null);
      const createdAt = new Date().toISOString();
      const method = await writeBack(finalOutput, targetPath);
      if (effectiveWorkspacePath && replyContent) {
        await saveReviewArchive({
          workspacePath: effectiveWorkspacePath,
          agent: null,
          reviewPath,
          replyPath,
          targetPath,
          replyContent,
          annotations: selectedAnns,
          submission: {
            createdAt,
            method,
            templateMode,
            userText,
            finalOutput,
          },
          targetBefore: targetContent,
          itemCount,
        });
        void useHistoryStore.getState().refreshHistory();
      }

      setLastSubmittedFingerprint(submissionFingerprint);
      setSubmitSuccessMethod(method);
      if (method === "written") {
        // Auto-close window after successful file write-back (Codex flow)
        closeWindowTimeoutRef.current = window.setTimeout(() => {
          submitLockedRef.current = false;
          setSubmitLocked(false);
          closeWindowTimeoutRef.current = null;
          void closeWindow();
        }, 800);
      } else {
        submitLockedRef.current = false;
        setSubmitLocked(false);
      }
    } catch (e) {
      submitLockedRef.current = false;
      setSubmitLocked(false);
      setWriteError(e instanceof Error ? e.message : t("return.writeFail"));
    } finally {
      setIsSubmitting(false);
    }
  }, [
    finalOutput,
    hasContent,
    itemCount,
    replyContent,
    replyPath,
    reviewPath,
    selectedAnns,
    t,
    targetContent,
    targetPath,
    templateMode,
    userText,
    effectiveWorkspacePath,
    hasSubmittedCurrentOutput,
    isReadOnly,
    submissionFingerprint,
  ]);

  useEffect(() => {
    if (collapsed || isReadOnly) return;
    const handler = (e: KeyboardEvent) => {
      if (matchShortcut(e, submitReturnShortcut)) {
        e.preventDefault();
        handleSubmit();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [collapsed, handleSubmit, isReadOnly, submitReturnShortcut]);

  return (
    <div
      style={{
        backgroundColor: "var(--color-surface-main)",
        fontFamily: "var(--font-sans)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
      }}
      data-testid="return-builder"
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
        data-testid="return-builder-header"
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
                disabled={isReadOnly}
                onClick={() => handleSetTemplate(mode)}
                title={t(TEMPLATE_LABELS[mode].descKey)}
                data-testid={`return-template-${mode}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "3px 8px",
                  borderRadius: "4px",
                  border: "none",
                  fontSize: "0.85rem",
                  fontFamily: "var(--font-sans)",
                  cursor: isReadOnly ? "default" : "pointer",
                  opacity: isReadOnly ? 0.6 : 1,
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
          <span data-testid="return-builder-collapse-indicator" data-collapsed={collapsed ? "true" : "false"}>
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
          </span>
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
          data-testid="return-builder-body"
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
              onChange={(e) => {
                if (!isReadOnly) {
                  setUserText(e.target.value);
                }
              }}
              readOnly={isReadOnly}
              placeholder={t("return.freeEditPlaceholder")}
              data-testid="return-free-edit"
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
                backgroundColor: isReadOnly
                  ? "var(--color-surface-hover)"
                  : "transparent",
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
            data-testid="return-aggregate-panel"
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
              {annotations.length > 0 && !isReadOnly && (
                <button
                  type="button"
                  onClick={handleToggleAll}
                  data-testid="return-select-all"
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
                data-testid="return-annotation-list"
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
                        data-testid="return-annotation-row"
                        data-annotation-id={ann.id}
                        style={{
                          display: "flex",
                          gap: "6px",
                          alignItems: "flex-start",
                          padding: "4px 4px",
                          borderRadius: "4px",
                          cursor: isReadOnly ? "default" : "pointer",
                          transition: "background 0.1s",
                          backgroundColor: isSelected
                            ? "var(--color-surface-hover)"
                            : "transparent",
                        }}
                        onMouseEnter={(e) => {
                          if (!isReadOnly && !isSelected)
                            e.currentTarget.style.backgroundColor =
                              "var(--color-surface-hover)";
                        }}
                        onMouseLeave={(e) => {
                          if (!isReadOnly && !isSelected)
                            e.currentTarget.style.backgroundColor =
                              "transparent";
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={isReadOnly}
                          onChange={() => {
                            if (!isReadOnly) {
                              toggleSelect(ann.id);
                            }
                          }}
                          data-testid="return-annotation-checkbox"
                          style={{
                            accentColor: "var(--color-accent)",
                            marginTop: "2px",
                            cursor: isReadOnly ? "default" : "pointer",
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
              <span style={{ fontSize: "0.85rem", color: "#ef4444" }} data-testid="return-status-error">
                {writeError}
              </span>
            )}
            {!writeError && isSubmitting && (
              <span
                style={{
                  fontSize: "0.85rem",
                  color: "var(--color-text-secondary)",
                }}
                data-testid="return-status-pending"
              >
                {targetPath && isTauri
                  ? t("return.submittingWriteBack")
                  : t("return.submittingCopy")}
              </span>
            )}
            {!writeError && !isSubmitting && submitSuccessMethod && (
              <span
                style={{
                  fontSize: "0.85rem",
                  color: "#10b981",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
                data-testid="return-status-success"
              >
                <Check style={{ width: "12px", height: "12px" }} />
                {submitSuccessMethod === "written"
                  ? t("return.written")
                  : t("return.copied")}
              </span>
            )}
            {!writeError && !isSubmitting && !submitSuccessMethod && (
              <span
                style={{
                  fontSize: "0.85rem",
                  color: "var(--color-text-secondary)",
                }}
              >
                {isReadOnly
                  ? t("history.readOnlyBadge")
                  : templateMode === "reply"
                    ? t("return.replyModeStatus")
                    : t("return.iterateModeStatus")}
                {!isReadOnly && selectedAnns.length > 0 &&
                  t("return.selectedCount", selectedAnns.length)}
              </span>
            )}
          </div>
          {!isReadOnly ? (
            <button
              type="button"
              disabled={
                !hasContent ||
                submitLocked ||
                hasSubmittedCurrentOutput
              }
              onClick={handleSubmit}
              data-testid="return-submit"
              aria-busy={isSubmitting}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 16px",
                borderRadius: "6px",
                border: "none",
                backgroundColor: hasContent
                  ? targetPath && isTauri ? "#10b981" : "#3b82f6"
                  : "var(--color-text-faint)",
                color: "#fff",
                fontSize: "0.9rem",
                fontWeight: 600,
                fontFamily: "var(--font-sans)",
                cursor:
                  !hasContent ||
                  submitLocked ||
                  hasSubmittedCurrentOutput
                    ? "not-allowed"
                    : "pointer",
                opacity:
                  !hasContent ||
                  submitLocked ||
                  hasSubmittedCurrentOutput
                    ? 0.6
                    : 1,
                transition: "all 0.15s",
              }}
            >
              {isSubmitting ? (
                <>{targetPath && isTauri ? t("return.submittingWriteBack") : t("return.submittingCopy")}</>
              ) : targetPath && isTauri ? (
                <><LogOut style={{ width: "13px", height: "13px" }} />{t("return.writeBackClose")}<span style={{ opacity: 0.7, fontSize: "0.75rem", marginLeft: "4px" }}>Ctrl+↵</span></>
              ) : (
                <><Copy style={{ width: "13px", height: "13px" }} />{t("return.copySubmit")}<span style={{ opacity: 0.7, fontSize: "0.75rem", marginLeft: "4px" }}>Ctrl+↵</span></>
              )}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
});
