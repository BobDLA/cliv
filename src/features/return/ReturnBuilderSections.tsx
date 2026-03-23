import { Check, CheckSquare, ChevronDown, ChevronUp, Copy, LogOut, MessageSquare, Repeat, Send, Square } from "lucide-react";
import type { MouseEventHandler, RefObject } from "react";
import type { Locale } from "@/lib/locales";
import type { Annotation, SubmissionRecord } from "@/types";
import {
  PROMPT_KIND_KEYS,
  TEMPLATE_LABELS,
  translateMessage,
  type TemplateMode,
} from "./returnBuilderUtils";

type TranslateFn = (key: string, n?: number | string) => string;

type ReturnBuilderHeaderProps = {
  collapsed: boolean;
  isReadOnly: boolean;
  onSetTemplate: (mode: TemplateMode) => void;
  onToggleCollapsed: () => void;
  selectedCount: number;
  t: TranslateFn;
  templateMode: TemplateMode;
};

type ReturnBuilderBodyProps = {
  allSelected: boolean;
  annotations: Annotation[];
  contentLocale: Locale;
  handleToggleAll: () => void;
  isReadOnly: boolean;
  onChangeUserText: (value: string) => void;
  onHDragStart: MouseEventHandler<HTMLDivElement>;
  panelHeight: number;
  selectedAnnotationIds: Set<string>;
  splitContainerRef: RefObject<HTMLDivElement | null>;
  splitRatio: number;
  t: TranslateFn;
  toggleSelect: (id: string) => void;
  userText: string;
};

type ReturnBuilderFooterProps = {
  hasContent: boolean;
  hasSubmittedCurrentOutput: boolean;
  isReadOnly: boolean;
  isSubmitting: boolean;
  isTauri: boolean;
  onSubmit: () => void;
  selectedCount: number;
  submitLocked: boolean;
  submitSuccessMethod: SubmissionRecord["method"] | null;
  t: TranslateFn;
  targetPath: string | null;
  templateMode: TemplateMode;
  writeError: string | null;
};

export function ReturnBuilderHeader({
  collapsed,
  isReadOnly,
  onSetTemplate,
  onToggleCollapsed,
  selectedCount,
  t,
  templateMode,
}: ReturnBuilderHeaderProps) {
  const selectedCountLabel =
    selectedCount > 0
      ? t("return.annotationCount", selectedCount).replace(
          `${selectedCount} `,
          "",
        )
      : null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "6px 12px",
        borderBottom: collapsed ? "none" : "1px solid var(--color-border-subtle)",
        cursor: "pointer",
      }}
      onClick={onToggleCollapsed}
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
        {selectedCount > 0 && selectedCountLabel && (
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
            {selectedCount} {selectedCountLabel}
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <div
          style={{ display: "flex", gap: "2px" }}
          onClick={(event) => event.stopPropagation()}
        >
          {(Object.keys(TEMPLATE_LABELS) as TemplateMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              disabled={isReadOnly}
              onClick={() => onSetTemplate(mode)}
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
                backgroundColor: templateMode === mode ? "#3b82f6" : "transparent",
                color:
                  templateMode === mode
                    ? "#fff"
                    : "var(--color-text-secondary)",
              }}
            >
              {mode === "reply" ? (
                <MessageSquare style={{ width: "11px", height: "11px" }} />
              ) : (
                <Repeat style={{ width: "11px", height: "11px" }} />
              )}
              {t(TEMPLATE_LABELS[mode].labelKey)}
            </button>
          ))}
        </div>
        <span
          data-testid="return-builder-collapse-indicator"
          data-collapsed={collapsed ? "true" : "false"}
        >
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
  );
}

export function ReturnBuilderBody({
  allSelected,
  annotations,
  contentLocale,
  handleToggleAll,
  isReadOnly,
  onChangeUserText,
  onHDragStart,
  panelHeight,
  selectedAnnotationIds,
  splitContainerRef,
  splitRatio,
  t,
  toggleSelect,
  userText,
}: ReturnBuilderBodyProps) {
  const sortedAnnotations = [...annotations].sort(
    (left, right) =>
      (left.range?.startOffset ?? 0) - (right.range?.startOffset ?? 0),
  );

  return (
    <div
      ref={splitContainerRef}
      style={{
        display: "flex",
        height: `${panelHeight}px`,
        overflow: "hidden",
      }}
      data-testid="return-builder-body"
    >
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
          onChange={(event) => {
            if (!isReadOnly) {
              onChangeUserText(event.target.value);
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
        onMouseEnter={(event) => {
          event.currentTarget.style.width = "2px";
        }}
        onMouseLeave={(event) => {
          event.currentTarget.style.width = "1px";
        }}
      />

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
            {sortedAnnotations.map((annotation) => {
              const isSelected = selectedAnnotationIds.has(annotation.id);

              return (
                <label
                  key={annotation.id}
                  data-testid="return-annotation-row"
                  data-annotation-id={annotation.id}
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
                  onMouseEnter={(event) => {
                    if (!isReadOnly && !isSelected) {
                      event.currentTarget.style.backgroundColor =
                        "var(--color-surface-hover)";
                    }
                  }}
                  onMouseLeave={(event) => {
                    if (!isReadOnly && !isSelected) {
                      event.currentTarget.style.backgroundColor = "transparent";
                    }
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={isReadOnly}
                    onChange={() => {
                      if (!isReadOnly) {
                        toggleSelect(annotation.id);
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
                      #
                      {translateMessage(
                        contentLocale,
                        PROMPT_KIND_KEYS[annotation.kind] ?? annotation.kind,
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: "0.85rem",
                        color: "var(--color-text-secondary)",
                        lineHeight: 1.4,
                        marginBottom: "2px",
                      }}
                    >
                      {translateMessage(contentLocale, "prompt.originalText")}:{" "}
                      {annotation.quote}
                    </div>
                    <div
                      style={{
                        fontSize: "0.95rem",
                        color: "var(--color-text-primary)",
                        lineHeight: 1.4,
                      }}
                    >
                      {translateMessage(contentLocale, "prompt.comment")}:{" "}
                      {annotation.comment}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function ReturnBuilderFooter({
  hasContent,
  hasSubmittedCurrentOutput,
  isReadOnly,
  isSubmitting,
  isTauri,
  onSubmit,
  selectedCount,
  submitLocked,
  submitSuccessMethod,
  t,
  targetPath,
  templateMode,
  writeError,
}: ReturnBuilderFooterProps) {
  const submitLabel = isSubmitting
    ? targetPath && isTauri
      ? t("return.submittingWriteBack")
      : t("return.submittingCopy")
    : targetPath && isTauri
      ? t("return.writeBackClose")
      : t("return.copySubmit");

  return (
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
          <span
            style={{ fontSize: "0.85rem", color: "#ef4444" }}
            data-testid="return-status-error"
          >
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
            {!isReadOnly &&
              selectedCount > 0 &&
              t("return.selectedCount", selectedCount)}
          </span>
        )}
      </div>
      {!isReadOnly ? (
        <button
          type="button"
          disabled={!hasContent || submitLocked || hasSubmittedCurrentOutput}
          onClick={onSubmit}
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
              ? targetPath && isTauri
                ? "#10b981"
                : "#3b82f6"
              : "var(--color-text-faint)",
            color: "#fff",
            fontSize: "0.9rem",
            fontWeight: 600,
            fontFamily: "var(--font-sans)",
            cursor:
              !hasContent || submitLocked || hasSubmittedCurrentOutput
                ? "not-allowed"
                : "pointer",
            opacity:
              !hasContent || submitLocked || hasSubmittedCurrentOutput ? 0.6 : 1,
            transition: "all 0.15s",
          }}
        >
          {isSubmitting ? (
            <>{submitLabel}</>
          ) : targetPath && isTauri ? (
            <>
              <LogOut style={{ width: "13px", height: "13px" }} />
              {submitLabel}
              <span
                style={{
                  opacity: 0.7,
                  fontSize: "0.75rem",
                  marginLeft: "4px",
                }}
              >
                Ctrl+↵
              </span>
            </>
          ) : (
            <>
              <Copy style={{ width: "13px", height: "13px" }} />
              {submitLabel}
              <span
                style={{
                  opacity: 0.7,
                  fontSize: "0.75rem",
                  marginLeft: "4px",
                }}
              >
                Ctrl+↵
              </span>
            </>
          )}
        </button>
      ) : null}
    </div>
  );
}
