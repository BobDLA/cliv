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
import { useUIStore, useAnnotationStore, useReturnStore, useDocumentStore } from "@/stores";
import { writeBack, closeWindow } from "@/services/writeBack";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export type TemplateMode = "reply" | "iterate";

const TEMPLATE_LABELS: Record<TemplateMode, { label: string; desc: string }> = {
  reply: { label: "回复模式", desc: "作为对话反馈返回当前会话" },
  iterate: { label: "迭代编辑", desc: "对同一文本反复修改完善" },
};

const TEMPLATE_DEFAULTS: Record<TemplateMode, string> = {
  reply:
    "请基于以下批注逐条回应。除非我明确要求，不要重写未标注的部分。",
  iterate:
    "请根据以下批注，对原文进行增量修改。保持未标注部分不变，仅修改被标注的内容。",
};

const KIND_LABELS: Record<string, string> = {
  comment: "评论",
  question: "提问",
  rewrite: "改写",
  challenge: "质疑",
};

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
  const fontSize = useUIStore((s) => s.fontSize);

  const [userText, setUserText] = useState(TEMPLATE_DEFAULTS["reply"]);
  const [templateMode, setTemplateMode] = useState<TemplateMode>("reply");

  // Switch template → insert default text into editor
  const handleSetTemplate = useCallback((mode: TemplateMode) => {
    setTemplateMode(mode);
    setUserText(TEMPLATE_DEFAULTS[mode]);
  }, []);

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
      const kind = KIND_LABELS[ann.kind] ?? ann.kind;
      return [
        `--- 批注 ${i + 1} ---`,
        `#${kind}`,
        `#原文: ${ann.quote.trim()}`,
        `#评论: ${ann.comment.trim()}`,
      ].join("\n");
    });
    return items.join("\n\n");
  }, [selectedAnns]);

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
      setWriteError(e instanceof Error ? e.message : "写回失败");
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
              fontSize: `${fontSize}px`,
              fontWeight: 600,
              color: "var(--color-text-primary)",
            }}
          >
            输出编辑器
          </span>
          {selectedAnns.length > 0 && (
            <span
              style={{
                fontSize: `${fontSize - 2}px`,
                padding: "1px 6px",
                borderRadius: "9999px",
                backgroundColor: "var(--color-accent)",
                color: "#fff",
                fontWeight: 500,
              }}
            >
              {selectedAnns.length} 条批注
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
                title={TEMPLATE_LABELS[mode].desc}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "3px 8px",
                  borderRadius: "4px",
                  border: "none",
                  fontSize: `${fontSize - 2}px`,
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
                {mode === "reply" ? (
                  <MessageSquare
                    style={{ width: "11px", height: "11px" }}
                  />
                ) : (
                  <Repeat style={{ width: "11px", height: "11px" }} />
                )}
                {TEMPLATE_LABELS[mode].label}
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
                fontSize: `${fontSize - 2}px`,
                fontWeight: 600,
                color: "var(--color-text-secondary)",
                borderBottom: "1px solid var(--color-border-subtle)",
                flexShrink: 0,
              }}
            >
              自由编辑（全文评论 / 额外指令）
            </div>
            <textarea
              value={userText}
              onChange={(e) => setUserText(e.target.value)}
              placeholder="在此输入对整篇文档的评论、额外指令或修改要求…"
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                resize: "none",
                padding: "8px 14px",
                fontSize: `${fontSize}px`,
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
                fontSize: `${fontSize - 2}px`,
                fontWeight: 600,
                color: "var(--color-text-secondary)",
                borderBottom: "1px solid var(--color-border-subtle)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              <span>批注聚合预览</span>
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
                    fontSize: `${fontSize - 3}px`,
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  {allSelected ? (
                    <CheckSquare style={{ width: "11px", height: "11px" }} />
                  ) : (
                    <Square style={{ width: "11px", height: "11px" }} />
                  )}
                  {allSelected ? "取消" : "全选"}
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
                  fontSize: `${fontSize - 1}px`,
                }}
              >
                暂无批注
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
                              fontSize: `${fontSize - 2}px`,
                              fontWeight: 600,
                              color: "var(--color-accent)",
                              marginBottom: "2px",
                            }}
                          >
                            #{KIND_LABELS[ann.kind] ?? ann.kind}
                          </div>
                          <div
                            style={{
                              fontSize: `${fontSize - 2}px`,
                              color: "var(--color-text-secondary)",
                              lineHeight: 1.4,
                              marginBottom: "2px",
                            }}
                          >
                            #原文: {ann.quote}
                          </div>
                          <div
                            style={{
                              fontSize: `${fontSize}px`,
                              color: "var(--color-text-primary)",
                              lineHeight: 1.4,
                            }}
                          >
                            #评论: {ann.comment}
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
              <span style={{ fontSize: `${fontSize - 2}px`, color: "#ef4444" }}>
                {writeError}
              </span>
            )}
            {copySuccess && (
              <span
                style={{
                  fontSize: `${fontSize - 2}px`,
                  color: "#10b981",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <Check style={{ width: "12px", height: "12px" }} />
                已复制到剪贴板
              </span>
            )}
            {!writeError && !copySuccess && (
              <span
                style={{
                  fontSize: `${fontSize - 2}px`,
                  color: "var(--color-text-secondary)",
                }}
              >
                {templateMode === "reply" ? "回复模式" : "迭代编辑模式"}
                {selectedAnns.length > 0 &&
                  ` · ${selectedAnns.length} 条批注已选`}
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
              fontSize: `${fontSize - 1}px`,
              fontWeight: 600,
              fontFamily: "var(--font-sans)",
              cursor: hasContent ? "pointer" : "not-allowed",
              opacity: hasContent ? 1 : 0.5,
              transition: "all 0.15s",
            }}
          >
            {composePath && isTauri ? (
              <><LogOut style={{ width: "13px", height: "13px" }} />写回并关闭</>
            ) : (
              <><Copy style={{ width: "13px", height: "13px" }} />复制并提交</>
            )}
          </button>
        </div>
      )}
    </div>
  );
});
