import type { SessionRecord, SessionSummary } from "./types";

export function toSessionSummary(session: SessionRecord): SessionSummary {
  return {
    id: session.id,
    name: session.name,
    documentPath: session.documentPath,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    annotationCount: session.annotations.length,
    returnCount: session.returns.length,
  };
}

export function sortSessionSummariesByUpdatedAtDesc(
  left: SessionSummary,
  right: SessionSummary,
): number {
  return (
    new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  );
}
