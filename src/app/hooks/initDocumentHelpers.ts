import { DEMO_CONTENT_EN, DEMO_CONTENT_ZH } from "@/app/demoContent";
import type { Locale } from "@/lib/locales";
import { getPathInfo, resolveWorkspacePath } from "@/lib/pathUtils";
import type { AppConfig, CliArgs, LoadResult } from "@/types";

export const isTauriEnvironment =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

type ExtractFn = () => Promise<string | null>;

type ReplyExtractionServices = {
  extractCodexReply: (
    sessionId: string | null,
    workspacePath?: string | null,
  ) => Promise<string>;
  extractClaudeReply: (sessionId: string | null) => Promise<string>;
  extractGeminiReply: (sessionId: string | null) => Promise<string>;
};

function buildExtractionAttempt(
  agent: string | null | undefined,
  services: ReplyExtractionServices,
  workspacePath: string | null,
): ExtractFn | null {
  const codex: ExtractFn = async () => {
    try {
      const reply = await services.extractCodexReply(null, workspacePath);
      return reply?.trim() ? reply : null;
    } catch {
      return null;
    }
  };

  const claude: ExtractFn = async () => {
    try {
      const reply = await services.extractClaudeReply(null);
      return reply?.trim() ? reply : null;
    } catch {
      return null;
    }
  };

  const gemini: ExtractFn = async () => {
    try {
      const reply = await services.extractGeminiReply(null);
      return reply?.trim() ? reply : null;
    } catch {
      return null;
    }
  };

  switch (agent) {
    case "codex":
      return codex;
    case "claude":
      return claude;
    case "gemini":
      return gemini;
    default:
      return null;
  }
}

export function shouldUseReplyExtractionFallback(
  args: Pick<CliArgs, "agent">,
): boolean {
  return Boolean(args.agent);
}

export async function recoverReplyContent(
  args: CliArgs,
  result: LoadResult,
  services: ReplyExtractionServices,
): Promise<string | null> {
  let replyContent = result.reply;

  // Fail closed unless an agent was actually detected.
  // Trusted-caller-only launches are compatibility write-target flows.
  if (
    (!replyContent || replyContent.trim() === "") &&
    shouldUseReplyExtractionFallback(args)
  ) {
    const attempt = buildExtractionAttempt(
      args.agent,
      services,
      args.workspacePath,
    );
    if (attempt) {
      const reply = await attempt();
      if (reply) {
        replyContent = reply;
      }
    }
  }

  return replyContent;
}

export function buildLoadedDocumentState(
  args: CliArgs,
  result: LoadResult,
  replyContent: string | null,
) {
  const workspacePath = resolveWorkspacePath({
    workspacePath: args.workspacePath,
    reviewPath: result.reviewPath ?? args.reviewPath ?? args.filePath,
    replyPath: result.replyPath,
    targetPath: result.targetPath,
  });

  return {
    reply: replyContent,
    target: result.target,
    targetPath: result.targetPath,
    reviewPath: result.reviewPath ?? args.reviewPath,
    replyPath: result.replyPath,
    workspacePath,
    archivedSubmission: null,
    documentId:
      result.metadata?.turn?.id ??
      result.reviewPath ??
      result.replyPath ??
      "default",
    isReadOnly: false,
  };
}

export function buildDemoDocumentState(locale: Locale) {
  return {
    reply: locale === "zh" ? DEMO_CONTENT_ZH : DEMO_CONTENT_EN,
    workspacePath: null,
    archivedSubmission: null,
    documentId: "demo",
    isReadOnly: false,
  };
}

export function buildOpenedFileDocumentState(path: string, content: string) {
  const { baseName } = getPathInfo(path);

  return {
    reply: content,
    target: null,
    targetPath: null,
    reviewPath: path,
    replyPath: path,
    workspacePath: resolveWorkspacePath({
      workspacePath: null,
      reviewPath: path,
      replyPath: path,
      targetPath: null,
    }),
    archivedSubmission: null,
    documentId: baseName || "file",
    isReadOnly: false,
  };
}

export function formatInitDocumentError(error: unknown): string {
  return `加载失败: ${error instanceof Error ? error.message : String(error)}`;
}

export function applyFetchedAppConfig(
  appConfig: AppConfig,
  setAppConfig: (config: AppConfig | null) => void,
  hydrateUIFromAppConfig: (config: AppConfig) => void,
) {
  setAppConfig(appConfig);
  hydrateUIFromAppConfig(appConfig);
}
