import { useCallback, useEffect, useRef, useState } from "react";
import { saveReviewArchive } from "@/services/historyService";
import { closeWindow, writeBack } from "@/services/writeBack";
import { useHistoryStore } from "@/stores";
import type { Annotation, SubmissionRecord } from "@/types";
import { clearTimeoutRef, type TemplateMode } from "./returnBuilderUtils";

type TranslateFn = (key: string, n?: number | string) => string;

type UseReturnSubmissionArgs = {
  documentId: string;
  effectiveWorkspacePath: string | null;
  finalOutput: string;
  hasContent: boolean;
  isReadOnly: boolean;
  itemCount: number;
  replyContent: string | null;
  replyPath: string | null;
  reviewPath: string | null;
  selectedAnnotations: Annotation[];
  submissionFingerprint: string;
  t: TranslateFn;
  targetContent: string | null;
  targetPath: string | null;
  templateMode: TemplateMode;
  userText: string;
};

export function useReturnSubmission({
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
}: UseReturnSubmissionArgs) {
  const [submitSuccessMethod, setSubmitSuccessMethod] = useState<
    SubmissionRecord["method"] | null
  >(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitLocked, setSubmitLocked] = useState(false);
  const [lastSubmittedFingerprint, setLastSubmittedFingerprint] = useState<
    string | null
  >(null);
  const [writeError, setWriteError] = useState<string | null>(null);
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
          annotations: selectedAnnotations,
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
    } catch (error) {
      submitLockedRef.current = false;
      setSubmitLocked(false);
      setWriteError(
        error instanceof Error ? error.message : t("return.writeFail"),
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    effectiveWorkspacePath,
    finalOutput,
    hasContent,
    hasSubmittedCurrentOutput,
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
  ]);

  return {
    handleSubmit,
    hasSubmittedCurrentOutput,
    isSubmitting,
    submitLocked,
    submitSuccessMethod,
    writeError,
  };
}
