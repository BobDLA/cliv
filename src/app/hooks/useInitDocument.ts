import { useEffect, useCallback } from "react";
import {
  useAnnotationStore,
  useConfigStore,
  useDocumentStore,
  useUIStore,
} from "@/stores";
import { DEMO_CONTENT_ZH, DEMO_CONTENT_EN } from "@/app/demoContent";

// Check if running inside Tauri
const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

type ExtractFn = () => Promise<string | null>;

/**
 * Build an ordered list of extraction attempts based on which agent triggered us.
 * The calling agent goes first; others follow as fallback.
 */
function buildExtractionPlan(
  agent: string | null | undefined,
  extractCodex: () => Promise<string>,
  extractClaude: () => Promise<string>,
  extractGemini: () => Promise<string>,
): ExtractFn[] {
  const codex: ExtractFn = async () => {
    try { const r = await extractCodex(); return r?.trim() ? r : null; } catch { return null; }
  };
  const claude: ExtractFn = async () => {
    try { const r = await extractClaude(); return r?.trim() ? r : null; } catch { return null; }
  };
  const gemini: ExtractFn = async () => {
    try { const r = await extractGemini(); return r?.trim() ? r : null; } catch { return null; }
  };

  switch (agent) {
    case "codex":   return [codex, claude, gemini];
    case "claude":  return [claude, gemini, codex];
    case "gemini":  return [gemini, claude, codex];
    default:        return [claude, gemini, codex]; // default fallback order
  }
}

/**
 * Hook: initialize document from CLI args (Tauri) or demo content (browser dev).
 */
export function useInitDocument() {
  const { setDocument, setLoading, setError } = useDocumentStore();
  const setAppConfig = useConfigStore((s) => s.setAppConfig);
  const locale = useUIStore((s) => s.locale);

  const loadDocument = useCallback(async () => {
    setLoading(true);

    if (isTauri) {
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
        setAppConfig(appConfig);
        const args = await getCliArgs();
        const result = await loadFiles(
          args.reviewPath,
          args.targetPath,
          args.metadataPath,
        );

        if (result.error && !result.reply) {
          setError(result.error);
          setLoading(false);
          return;
        }

        // Try to extract the last reply using cached hooks
        let replyContent = result.reply;
        if (!replyContent || replyContent.trim() === "") {
          const plan = buildExtractionPlan(
            args.agent,
            () => extractCodexReply(null, args.workspacePath),
            () => extractClaudeReply(null),
            () => extractGeminiReply(null),
          );

          for (const attempt of plan) {
            const reply = await attempt();
            if (reply) {
              replyContent = reply;
              break;
            }
          }
        }

        // Clear previous annotations on reload
        useAnnotationStore.getState().clearAnnotations();

        setDocument({
          reply: replyContent,
          target: result.target,
          targetPath: result.targetPath,
          reviewPath: result.reviewPath ?? args.reviewPath,
          replyPath: result.replyPath,
          workspacePath: args.workspacePath,
          documentId:
            result.metadata?.turn?.id ??
            result.reviewPath ??
            result.replyPath ??
            "default",
          isReadOnly: false,
        });
      } catch (e) {
        setError(
          `加载失败: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    } else {
      // Browser dev mode: use demo content
      const demoContent = locale === "zh" ? DEMO_CONTENT_ZH : DEMO_CONTENT_EN;
      setDocument({ reply: demoContent, documentId: "demo", isReadOnly: false });
    }

    setLoading(false);
  }, [setAppConfig, setDocument, setLoading, setError, locale]);

  useEffect(() => {
    loadDocument();
  }, [loadDocument]);
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
    if (isTauri) {
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
          setDocument({
            reply: content,
            target: null,
            targetPath: null,
            reviewPath: selected,
            replyPath: selected,
            documentId: selected.split("/").pop() ?? selected.split("\\").pop() ?? "file",
            isReadOnly: false,
          });
          useAnnotationStore.getState().clearAnnotations();
        }
      } catch (err) {
        console.error("Failed to open file via Tauri dialog:", err);
        // Tauri command may not exist yet — fallback to browser file input
        fileInputRef.current?.click();
      }
    } else {
      fileInputRef.current?.click();
    }
  };
}
