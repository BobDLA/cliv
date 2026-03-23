import type { SessionRecord } from "./types";
import { SESSION_STORAGE_KEY } from "./types";

export function readSessionRecords(): SessionRecord[] {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function writeSessionRecords(sessions: SessionRecord[]): void {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessions));
  } catch (error) {
    console.error("[SessionService] Failed to persist sessions:", error);
  }
}
