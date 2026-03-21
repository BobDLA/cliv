import { invoke } from "@tauri-apps/api/core";
import type {
  AppConfig,
  CliArgs,
  HistoryWorkspaceGroup,
  LoadResult,
  ReviewArchiveData,
  SaveReviewArchiveInput,
  SessionListItem,
} from "@/types";

/**
 * Tauri IPC service — thin wrapper over invoke().
 * All file I/O goes through here; frontend never touches fs directly.
 */

export async function getCliArgs(): Promise<CliArgs> {
  return invoke<CliArgs>("get_cli_args");
}

export async function getAppConfig(): Promise<AppConfig> {
  return invoke<AppConfig>("get_app_config");
}

export async function loadFiles(
  reviewPath?: string | null,
  targetPath?: string | null,
  metadataPath?: string | null,
): Promise<LoadResult> {
  return invoke<LoadResult>("load_files", {
    reviewPath: reviewPath ?? null,
    targetPath: targetPath ?? null,
    metadataPath: metadataPath ?? null,
  });
}

export async function readFile(path: string): Promise<string> {
  return invoke<string>("read_file", { path });
}

export async function writeBack(
  path: string,
  content: string,
): Promise<void> {
  return invoke<void>("write_back", { path, content });
}

export async function saveReviewArchive(
  input: SaveReviewArchiveInput,
): Promise<void> {
  await invoke("save_review_archive", { input });
}

export async function listReviewHistory(): Promise<HistoryWorkspaceGroup[]> {
  return invoke<HistoryWorkspaceGroup[]>("list_review_history");
}

export async function loadReviewArchive(
  workspaceKey: string,
  archiveId: string,
): Promise<ReviewArchiveData> {
  return invoke<ReviewArchiveData>("load_review_archive", {
    workspaceKey,
    archiveId,
  });
}

export async function saveSession(
  sessionId: string,
  turnId: string,
  data: string,
): Promise<void> {
  return invoke<void>("save_session", { sessionId, turnId, data });
}

export async function saveReturnRecord(
  sessionId: string,
  turnId: string,
  data: string,
): Promise<void> {
  return invoke<void>("save_return_record", { sessionId, turnId, data });
}

export async function loadSessionData(
  sessionId: string,
  turnId: string,
): Promise<string> {
  return invoke<string>("load_session_data", { sessionId, turnId });
}

export async function listSessions(): Promise<SessionListItem[]> {
  return invoke<SessionListItem[]>("list_sessions");
}

export async function extractCodexReply(
  threadId?: string | null,
  cwd?: string | null,
): Promise<string> {
  return invoke<string>("extract_codex_reply", {
    threadId: threadId ?? null,
    cwd: cwd ?? null,
  });
}

export async function extractClaudeReply(
  sessionId?: string | null,
): Promise<string> {
  return invoke<string>("extract_claude_reply", {
    sessionId: sessionId ?? null,
  });
}

export async function extractGeminiReply(
  sessionId?: string | null,
): Promise<string> {
  return invoke<string>("extract_gemini_reply", {
    sessionId: sessionId ?? null,
  });
}
