import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  useAnnotationStore,
  useConfigStore,
  useDocumentStore,
  useReturnStore,
  useUIStore,
} from "@/stores";
import { resolveWorkspacePath } from "@/lib/pathUtils";
import { matchShortcut } from "@/lib/shortcuts";
import { useT } from "@/lib/useT";
import { detectContentLocale } from "@/lib/locales";
import {
  ReturnBuilderBody,
  ReturnBuilderFooter,
  ReturnBuilderHeader,
} from "./ReturnBuilderSections";
import { buildAnnotationPrompt } from "./returnBuilderUtils";
import { useReturnBuilderLayout } from "./useReturnBuilderLayout";
import { useReturnEditorState } from "./useReturnEditorState";
import { useReturnSubmission } from "./useReturnSubmission";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/**
 * ReturnBuilder — bottom split panel.
 * Left: user custom editing area (global comments, free-form text).
 * Right: aggregated annotations with checkboxes.
 * Template selector + submit button.
 */
export const ReturnBuilder = memo(function ReturnBuilder() {
  const annotations = useAnnotationStore((state) => state.annotations);
  const promptConfig = useConfigStore((state) => state.promptConfig);
  const { deselectAll, selectAll, selectedAnnotationIds, toggleSelect } =
    useReturnStore();
  const archivedSubmission = useDocumentStore((state) => state.archivedSubmission);
  const documentId = useDocumentStore((state) => state.documentId);
  const isReadOnly = useDocumentStore((state) => state.isReadOnly);
  const replyContent = useDocumentStore((state) => state.replyContent);
  const replyPath = useDocumentStore((state) => state.replyPath);
  const reviewPath = useDocumentStore((state) => state.reviewPath);
  const targetContent = useDocumentStore((state) => state.targetContent);
  const targetPath = useDocumentStore((state) => state.targetPath);
  const workspacePath = useDocumentStore((state) => state.workspacePath);
  const submitReturnShortcut = useUIStore(
    (state) => state.shortcuts.submitReturn,
  );
  const uiLocale = useUIStore((state) => state.locale);
  const t = useT();

  const contentLocale = useMemo(() => {
    const combinedText = annotations
      .map((annotation) => `${annotation.quote} ${annotation.comment}`)
      .join("\n");
    if (!combinedText) {
      return uiLocale;
    }
    return detectContentLocale(combinedText);
  }, [annotations, uiLocale]);

  const { handleSetTemplate, setUserText, templateMode, userText, userTextSeed } =
    useReturnEditorState({
      archivedSubmission,
      contentLocale,
      documentId,
      isReadOnly,
      promptConfig,
      targetContent,
    });

  useEffect(() => {
    if (annotations.length > 0) {
      selectAll(annotations.map((annotation) => annotation.id));
    }
  }, [annotations, selectAll]);

  const { onHDragStart, onVDragStart, panelHeight, splitContainerRef, splitRatio } =
    useReturnBuilderLayout();

  const [collapsed, setCollapsed] = useState(false);

  const selectedAnnotations = useMemo(() => {
    return [...annotations]
      .filter((annotation) => selectedAnnotationIds.has(annotation.id))
      .sort(
        (left, right) =>
          (left.range?.startOffset ?? 0) - (right.range?.startOffset ?? 0),
      );
  }, [annotations, selectedAnnotationIds]);

  const annotationPrompt = useMemo(
    () => buildAnnotationPrompt(selectedAnnotations, contentLocale, replyContent),
    [contentLocale, replyContent, selectedAnnotations],
  );

  const finalOutput = useMemo(() => {
    const parts: string[] = [];
    if (userText.trim()) {
      parts.push(userText.trim());
    }
    if (annotationPrompt) {
      parts.push(annotationPrompt);
    }
    return parts.join("\n\n---\n\n");
  }, [annotationPrompt, userText]);

  const allSelected =
    annotations.length > 0 &&
    annotations.every((annotation) => selectedAnnotationIds.has(annotation.id));
  const hasContent = finalOutput.trim().length > 0;
  const freeInputAddsItem =
    userText.trim().length > 0 && userText.trim() !== userTextSeed.trim();
  const itemCount = hasContent
    ? Math.max(selectedAnnotations.length + (freeInputAddsItem ? 1 : 0), 1)
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

  const {
    handleSubmit,
    hasSubmittedCurrentOutput,
    isSubmitting,
    submitLocked,
    submitSuccessMethod,
    writeError,
  } = useReturnSubmission({
    documentId,
    effectiveWorkspacePath,
    finalOutput,
    hasContent,
    isReadOnly,
    itemCount,
    replyContent,
    replyPath,
    reviewPath,
    selectedAnnotations,
    submissionFingerprint,
    t,
    targetContent,
    targetPath,
    templateMode,
    userText,
  });

  const handleToggleAll = useCallback(() => {
    if (isReadOnly) {
      return;
    }
    if (allSelected) {
      deselectAll();
    } else {
      selectAll(annotations.map((annotation) => annotation.id));
    }
  }, [allSelected, annotations, deselectAll, isReadOnly, selectAll]);

  useEffect(() => {
    if (collapsed || isReadOnly) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (matchShortcut(event, submitReturnShortcut)) {
        event.preventDefault();
        handleSubmit();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
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
          onMouseEnter={(event) => {
            event.currentTarget.style.height = "2px";
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.height = "1px";
          }}
        />
      </div>

      <ReturnBuilderHeader
        collapsed={collapsed}
        isReadOnly={isReadOnly}
        onSetTemplate={handleSetTemplate}
        onToggleCollapsed={() => setCollapsed((current) => !current)}
        selectedCount={selectedAnnotations.length}
        t={t}
        templateMode={templateMode}
      />

      {!collapsed && (
        <ReturnBuilderBody
          allSelected={allSelected}
          annotations={annotations}
          contentLocale={contentLocale}
          handleToggleAll={handleToggleAll}
          isReadOnly={isReadOnly}
          onChangeUserText={setUserText}
          onHDragStart={onHDragStart}
          panelHeight={panelHeight}
          selectedAnnotationIds={selectedAnnotationIds}
          splitContainerRef={splitContainerRef}
          splitRatio={splitRatio}
          t={t}
          toggleSelect={toggleSelect}
          userText={userText}
        />
      )}

      {!collapsed && (
        <ReturnBuilderFooter
          hasContent={hasContent}
          hasSubmittedCurrentOutput={hasSubmittedCurrentOutput}
          isReadOnly={isReadOnly}
          isSubmitting={isSubmitting}
          isTauri={isTauri}
          onSubmit={handleSubmit}
          selectedCount={selectedAnnotations.length}
          submitLocked={submitLocked}
          submitSuccessMethod={submitSuccessMethod}
          t={t}
          targetPath={targetPath}
          templateMode={templateMode}
          writeError={writeError}
        />
      )}
    </div>
  );
});
