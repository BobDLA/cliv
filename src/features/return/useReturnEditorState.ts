import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Locale } from "@/lib/locales";
import type { PromptConfig, SubmissionRecord } from "@/types";
import {
  normalizeTemplateMode,
  resolveUserTextSeed,
  type TemplateMode,
} from "./returnBuilderUtils";

type UseReturnEditorStateArgs = {
  archivedSubmission: SubmissionRecord | null;
  contentLocale: Locale;
  documentId: string;
  isReadOnly: boolean;
  promptConfig: PromptConfig | null;
  targetContent?: string | null;
};

export function useReturnEditorState({
  archivedSubmission,
  contentLocale,
  documentId,
  isReadOnly,
  promptConfig,
  targetContent,
}: UseReturnEditorStateArgs) {
  const [templateMode, setTemplateMode] = useState<TemplateMode>("reply");
  const userTextSeed = useMemo(
    () =>
      resolveUserTextSeed(contentLocale, templateMode, promptConfig, targetContent),
    [contentLocale, promptConfig, targetContent, templateMode],
  );
  const [userText, setUserText] = useState(userTextSeed);
  const previousDocumentIdRef = useRef(documentId);
  const previousUserTextSeedRef = useRef(userTextSeed);

  useEffect(() => {
    const documentChanged = previousDocumentIdRef.current !== documentId;
    const previousSeed = previousUserTextSeedRef.current;
    const nextSeed =
      isReadOnly && archivedSubmission ? archivedSubmission.userText : userTextSeed;

    previousDocumentIdRef.current = documentId;
    previousUserTextSeedRef.current = nextSeed;

    if (isReadOnly && archivedSubmission) {
      setTemplateMode(normalizeTemplateMode(archivedSubmission.templateMode));
    }

    setUserText((previousText) => {
      if (documentChanged || previousText === previousSeed) {
        return nextSeed;
      }
      return previousText;
    });
  }, [archivedSubmission, documentId, isReadOnly, userTextSeed]);

  const handleSetTemplate = useCallback(
    (mode: TemplateMode) => {
      if (isReadOnly) {
        return;
      }

      setTemplateMode(mode);
      setUserText(
        resolveUserTextSeed(contentLocale, mode, promptConfig, targetContent),
      );
    },
    [contentLocale, isReadOnly, promptConfig, targetContent],
  );

  return {
    handleSetTemplate,
    setUserText,
    templateMode,
    userText,
    userTextSeed,
  };
}
