import type { Annotation, ReturnBatch } from "@/types";
import {
  deleteSessionRecord,
  findSessionRecord,
  listSessionRecords,
  replaceSessionRecord,
  updateSessionRecord,
} from "./sessionService/repository";
import {
  sortSessionSummariesByUpdatedAtDesc,
  toSessionSummary,
} from "./sessionService/summary";
import type {
  SessionRecord,
  SessionSummary,
} from "./sessionService/types";

export type {
  SessionRecord,
  SessionSummary,
} from "./sessionService/types";

// ─── Public API ───────────────────────────────────────────

/**
 * List all sessions (summaries only, sorted by updatedAt desc).
 */
export function listSessions(): SessionSummary[] {
  return listSessionRecords()
    .map(toSessionSummary)
    .sort(sortSessionSummariesByUpdatedAtDesc);
}

/**
 * Load a session by ID. Returns null if not found.
 */
export function loadSession(id: string): SessionRecord | null {
  return findSessionRecord(id);
}

/**
 * Save or update a session. If it exists, it's replaced.
 */
export function saveSession(session: SessionRecord): void {
  replaceSessionRecord(session);
}

/**
 * Delete a session by ID.
 */
export function deleteSession(id: string): void {
  deleteSessionRecord(id);
}

/**
 * Create a new session from the current state.
 */
export function createSession(
  name: string,
  documentPath: string | null,
  annotations: Annotation[],
  returns: ReturnBatch[],
): SessionRecord {
  const now = new Date().toISOString();
  const session: SessionRecord = {
    id: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    documentPath,
    createdAt: now,
    updatedAt: now,
    annotations,
    returns,
  };
  saveSession(session);
  return session;
}

/**
 * Update annotations for an existing session.
 */
export function saveAnnotations(
  sessionId: string,
  annotations: Annotation[],
): void {
  void updateSessionRecord(sessionId, (session) => ({
    ...session,
    annotations,
    updatedAt: new Date().toISOString(),
  }));
}

/**
 * Append a return batch to a session.
 */
export function saveReturn(
  sessionId: string,
  batch: ReturnBatch,
): void {
  void updateSessionRecord(sessionId, (session) => ({
    ...session,
    returns: [...session.returns, batch],
    updatedAt: new Date().toISOString(),
  }));
}
