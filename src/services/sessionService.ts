import type { Annotation, ReturnBatch } from "@/types";

// ─── Session Data Structures ──────────────────────────────

export interface SessionRecord {
  id: string;
  name: string;
  documentPath: string | null;
  createdAt: string;
  updatedAt: string;
  annotations: Annotation[];
  returns: ReturnBatch[];
}

export interface SessionSummary {
  id: string;
  name: string;
  documentPath: string | null;
  createdAt: string;
  updatedAt: string;
  annotationCount: number;
  returnCount: number;
}

const STORAGE_KEY = "cliv-sessions";

// ─── Persistence Layer (localStorage MVP) ─────────────────

function readAll(): SessionRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeAll(sessions: SessionRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch (e) {
    console.error("[SessionService] Failed to persist sessions:", e);
  }
}

// ─── Public API ───────────────────────────────────────────

/**
 * List all sessions (summaries only, sorted by updatedAt desc).
 */
export function listSessions(): SessionSummary[] {
  return readAll()
    .map((s) => ({
      id: s.id,
      name: s.name,
      documentPath: s.documentPath,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      annotationCount: s.annotations.length,
      returnCount: s.returns.length,
    }))
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
}

/**
 * Load a session by ID. Returns null if not found.
 */
export function loadSession(id: string): SessionRecord | null {
  return readAll().find((s) => s.id === id) ?? null;
}

/**
 * Save or update a session. If it exists, it's replaced.
 */
export function saveSession(session: SessionRecord): void {
  const all = readAll();
  const idx = all.findIndex((s) => s.id === session.id);
  if (idx >= 0) {
    all[idx] = session;
  } else {
    all.push(session);
  }
  writeAll(all);
}

/**
 * Delete a session by ID.
 */
export function deleteSession(id: string): void {
  writeAll(readAll().filter((s) => s.id !== id));
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
  const session = loadSession(sessionId);
  if (!session) return;
  session.annotations = annotations;
  session.updatedAt = new Date().toISOString();
  saveSession(session);
}

/**
 * Append a return batch to a session.
 */
export function saveReturn(
  sessionId: string,
  batch: ReturnBatch,
): void {
  const session = loadSession(sessionId);
  if (!session) return;
  session.returns.push(batch);
  session.updatedAt = new Date().toISOString();
  saveSession(session);
}
