// ─── Annotation ───────────────────────────────────────────

export type AnnotationKind = "comment" | "question" | "rewrite" | "challenge";
export type AnnotationStatus = "open" | "resolved";

export interface AnnotationRange {
  startOffset: number;
  endOffset: number;
  paragraphIndex?: number;
  contextSnippet?: string;
}

export interface Annotation {
  id: string;
  documentId: string;
  quote: string;
  comment: string;
  range?: AnnotationRange;
  kind: AnnotationKind;
  status: AnnotationStatus;
  createdAt: string;
}

// ─── Session / Turn / Document ────────────────────────────

export interface SessionMeta {
  id: string;
  name: string;
}

export interface TurnMeta {
  id: string;
  agent: string;
  createdAt: string;
}

export interface ReplyMeta {
  path: string;
}

export interface TargetMeta {
  mode: string;
  composePath: string;
}

export interface Metadata {
  version: string;
  session: SessionMeta;
  turn: TurnMeta;
  reply: ReplyMeta;
  target: TargetMeta;
}

export interface LoadResult {
  compose: string | null;
  reply: string | null;
  metadata: Metadata | null;
  composePath: string | null;
  replyPath: string | null;
  error: string | null;
}

// ─── Session List ─────────────────────────────────────────

export interface SessionListItem {
  id: string;
  modifiedAt: string;
  turnCount: number;
}

// ─── CLI Args ─────────────────────────────────────────────

export interface CliArgs {
  composePath: string | null;
  metadataPath: string | null;
  filePath: string | null;
  /** Which agent triggered the launch: "codex" | "claude" | "gemini" | "unknown" */
  agent: string | null;
}

// ─── Selection ────────────────────────────────────────────

export interface SelectionInfo {
  quote: string;
  range: AnnotationRange;
  rect: { top: number; left: number; bottom: number; width: number };
}

// ─── Theme ────────────────────────────────────────────────

export type Theme = "dark" | "dim" | "light";

// ─── Return / Write-back ──────────────────────────────────

export interface ReturnBatch {
  id: string;
  annotationIds: string[];
  prompt: string;
  createdAt: string;
  status: "pending" | "written" | "clipboard";
}
