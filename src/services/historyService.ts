import type {
  HistoryWorkspaceGroup,
  ReviewArchiveData,
  SaveReviewArchiveInput,
} from "@/types";

const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export async function saveReviewArchive(
  input: SaveReviewArchiveInput,
): Promise<void> {
  if (!isTauri) return;
  const { saveReviewArchive: saveReviewArchiveViaTauri } = await import(
    "@/services/tauri-ipc"
  );
  await saveReviewArchiveViaTauri(input);
}

export async function listReviewHistory(): Promise<HistoryWorkspaceGroup[]> {
  if (!isTauri) return [];
  const { listReviewHistory: listReviewHistoryViaTauri } = await import(
    "@/services/tauri-ipc"
  );
  return listReviewHistoryViaTauri();
}

export async function loadReviewArchive(
  workspaceKey: string,
  archiveId: string,
): Promise<ReviewArchiveData | null> {
  if (!isTauri) return null;
  const { loadReviewArchive: loadReviewArchiveViaTauri } = await import(
    "@/services/tauri-ipc"
  );
  return loadReviewArchiveViaTauri(workspaceKey, archiveId);
}
