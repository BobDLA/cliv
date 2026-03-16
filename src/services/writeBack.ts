/**
 * Write-back service.
 * Supports file write via Tauri IPC (primary) and clipboard (fallback).
 */

const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export async function writeToClipboard(content: string): Promise<void> {
  if (!navigator.clipboard) {
    throw new Error("剪贴板 API 不可用");
  }
  await navigator.clipboard.writeText(content);
}

/**
 * Write content to file via Tauri IPC (atomic write).
 * Only available in Tauri environment.
 */
export async function writeToFile(
  path: string,
  content: string,
): Promise<void> {
  if (!isTauri) {
    throw new Error("文件写入仅在 Tauri 环境中可用");
  }
  const { writeBack: tauriWriteBack } = await import("@/services/tauri-ipc");
  await tauriWriteBack(path, content);
}

/**
 * Close the application window (Tauri only).
 * Used after successful write-back in Codex integration flow.
 */
export async function closeWindow(): Promise<void> {
  if (!isTauri) return;
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().close();
  } catch (e) {
    console.warn("[closeWindow] Failed:", e);
  }
}

/**
 * Unified write-back: try file first (if path exists), fallback to clipboard.
 * Returns the method used.
 */
export async function writeBack(
  content: string,
  composePath?: string | null,
): Promise<"written" | "clipboard"> {
  if (composePath && isTauri) {
    try {
      await writeToFile(composePath, content);
      return "written";
    } catch {
      // fallback to clipboard
    }
  }

  await writeToClipboard(content);
  return "clipboard";
}
