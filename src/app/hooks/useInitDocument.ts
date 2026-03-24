import { useCallback, useEffect } from "react";
import {
  useAnnotationStore,
  useConfigStore,
  useDocumentStore,
  useUIStore,
} from "@/stores";
import { hydrateUIFromAppConfig } from "@/stores/uiStore";
import {
  applyFetchedAppConfig,
  buildDemoDocumentState,
  buildLoadedDocumentState,
  buildOpenedFileDocumentState,
  formatInitDocumentError,
  isTauriEnvironment,
  recoverReplyContent,
  shouldUseReplyExtractionFallback,
} from "./initDocumentHelpers";

export { shouldUseReplyExtractionFallback };

/**
 * Hook: initialize document from CLI args (Tauri) or demo content (browser dev).
 */
export function useInitDocument() {
  const { setDocument, setLoading, setError } = useDocumentStore();
  const clearAnnotations = useAnnotationStore((state) => state.clearAnnotations);
  const setAppConfig = useConfigStore((state) => state.setAppConfig);
  const locale = useUIStore((state) => state.locale);

  const loadTauriDocument = useCallback(async () => {
    setLoading(true);

    try {
      const {
        getAppConfig,
        getCliArgs,
        loadFiles,
        extractCodexReply,
        extractClaudeReply,
        extractGeminiReply,
      } = await import("@/services/tauri-ipc");
      const appConfig = await getAppConfig();
      applyFetchedAppConfig(appConfig, setAppConfig, hydrateUIFromAppConfig);

      const args = await getCliArgs();
      const result = await loadFiles(
        args.reviewPath,
        args.targetPath,
        args.metadataPath,
      );

      if (result.error && !result.reply) {
        setError(result.error);
        return;
      }

      const replyContent = await recoverReplyContent(args, result, {
        extractCodexReply,
        extractClaudeReply,
        extractGeminiReply,
      });

      clearAnnotations();
      setDocument(buildLoadedDocumentState(args, result, replyContent));
    } catch (error) {
      setError(formatInitDocumentError(error));
    } finally {
      setLoading(false);
    }
  }, [clearAnnotations, setAppConfig, setDocument, setError, setLoading]);

  useEffect(() => {
    if (!isTauriEnvironment) {
      return;
    }

    void loadTauriDocument();
  }, [loadTauriDocument]);

  useEffect(() => {
    if (isTauriEnvironment) {
      return;
    }

    setLoading(true);
    clearAnnotations();
    setDocument(buildDemoDocumentState(locale));
    setLoading(false);
  }, [clearAnnotations, locale, setDocument, setLoading]);
}

/**
 * Open file handler — works in both browser and Tauri.
 * Returns a function to trigger the file open dialog or browser file input.
 */
export function openFileFromTauri(
  setDocument: ReturnType<typeof useDocumentStore.getState>["setDocument"],
  fileInputRef: React.RefObject<HTMLInputElement | null>,
) {
  return async () => {
    if (isTauriEnvironment) {
      try {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const { invoke } = await import("@tauri-apps/api/core");

        const selected = await open({
          multiple: false,
          filters: [{ name: "Markdown", extensions: ["md", "markdown", "txt"] }],
        });

        if (selected && typeof selected === "string") {
          const content = await invoke<string>("read_file", {
            path: selected,
          });
          setDocument(buildOpenedFileDocumentState(selected, content));
          useAnnotationStore.getState().clearAnnotations();
        }
      } catch (error) {
        console.error("Failed to open file via Tauri dialog:", error);
        // Tauri command may not exist yet — fallback to browser file input
        fileInputRef.current?.click();
      }
    } else {
      fileInputRef.current?.click();
    }
  };
}
