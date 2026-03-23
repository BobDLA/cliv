import type { SessionRecord } from "./types";
import { readSessionRecords, writeSessionRecords } from "./storage";

export function listSessionRecords(): SessionRecord[] {
  return readSessionRecords();
}

export function findSessionRecord(id: string): SessionRecord | null {
  return readSessionRecords().find((session) => session.id === id) ?? null;
}

export function replaceSessionRecord(session: SessionRecord): void {
  const sessions = readSessionRecords();
  const existingIndex = sessions.findIndex(
    (current) => current.id === session.id,
  );
  if (existingIndex >= 0) {
    sessions[existingIndex] = session;
  } else {
    sessions.push(session);
  }
  writeSessionRecords(sessions);
}

export function updateSessionRecord(
  id: string,
  update: (session: SessionRecord) => SessionRecord,
): boolean {
  const sessions = readSessionRecords();
  const existingIndex = sessions.findIndex((session) => session.id === id);
  if (existingIndex < 0) return false;

  sessions[existingIndex] = update(sessions[existingIndex]);
  writeSessionRecords(sessions);
  return true;
}

export function deleteSessionRecord(id: string): void {
  writeSessionRecords(
    readSessionRecords().filter((session) => session.id !== id),
  );
}
