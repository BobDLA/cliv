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
  target: string | null;
  reply: string | null;
  metadata: Metadata | null;
  targetPath: string | null;
  reviewPath: string | null;
  replyPath: string | null;
  error: string | null;
}

// ─── Session List ─────────────────────────────────────────

export interface SessionListItem {
  id: string;
  modifiedAt: string;
  turnCount: number;
}

// ─── Review History ──────────────────────────────────────

export interface SubmissionRecord {
  createdAt: string;
  method: "written" | "clipboard";
  templateMode: string;
  userText: string;
  finalOutput: string;
}

export interface HistoryEntrySummary {
  id: string;
  workspaceKey: string;
  workspaceLabel: string;
  workspacePath: string;
  archivedAt: string;
  agent: string | null;
  reviewPath: string | null;
  replyPath: string | null;
  targetPath: string | null;
  submittedChars: number;
  itemCount: number;
  preview: string;
  searchText: string;
}

export interface HistoryWorkspaceGroup {
  key: string;
  label: string;
  path: string;
  entries: HistoryEntrySummary[];
}

export interface ReviewArchiveData {
  summary: HistoryEntrySummary;
  replyContent: string;
  annotations: Annotation[];
  submission: SubmissionRecord | null;
  targetBefore: string | null;
}

export interface SaveReviewArchiveInput {
  workspacePath: string;
  agent?: string | null;
  reviewPath?: string | null;
  replyPath?: string | null;
  targetPath?: string | null;
  replyContent: string;
  annotations: Annotation[];
  submission: SubmissionRecord;
  targetBefore?: string | null;
  itemCount: number;
}

// ─── CLI Args ─────────────────────────────────────────────

export interface CliArgs {
  reviewPath: string | null;
  targetPath: string | null;
  metadataPath: string | null;
  filePath: string | null;
  workspacePath: string | null;
  /** Which agent triggered the launch: "codex" | "claude" | "gemini" | "unknown" */
  agent: string | null;
  trustedCaller: string | null;
}

// ─── UI Preferences ───────────────────────────────────────

export type Theme = "dark" | "dim" | "light";
export type SidebarTab = "outline" | "history";
export type ContentWidth = "narrow" | "standard" | "wide";
export type PagePadding = "compact" | "comfortable" | "airy";
export type ReadingDensity = "compact" | "comfortable" | "relaxed";
export type HighlightStrength = "subtle" | "balanced" | "strong";
export type ShortcutCommand =
  | "openFile"
  | "search"
  | "submitReturn"
  | "submitAnnotation"
  | "addAnnotation"
  | "fontIncrease"
  | "fontDecrease"
  | "fontReset";

// ─── App Config ───────────────────────────────────────────

export interface LaunchConfig {
  scanDepth: number;
  trustedCallers: string[];
  ignoredCallers: string[];
}

export interface PromptConfig {
  replyHeaderZh: string | null;
  replyHeaderEn: string | null;
  iterateHeaderZh: string | null;
  iterateHeaderEn: string | null;
}

export interface ShortcutConfig {
  openFile: string;
  search: string;
  submitReturn: string;
  submitAnnotation: string;
  addAnnotation: string;
  fontIncrease: string;
  fontDecrease: string;
  fontReset: string;
}

export interface UiConfig {
  theme: Theme;
  fontSize: number;
  locale: "zh" | "en";
  sidebarOpen: boolean;
  sidebarTab: SidebarTab;
  sidebarWidth: number;
  annotationMarginWidth: number;
  contentWidth: ContentWidth;
  pagePadding: PagePadding;
  readingDensity: ReadingDensity;
  highlightStrength: HighlightStrength;
  shortcuts: ShortcutConfig;
}

export interface AppConfigStatus {
  path: string;
  exists: boolean;
  launchConfigured: boolean;
  promptsConfigured: boolean;
  uiConfigured: boolean;
}

export interface SaveAppConfigInput {
  prompts?: PromptConfig | null;
  ui?: UiConfig | null;
}

export interface AppConfig {
  launch: LaunchConfig;
  prompts: PromptConfig;
  ui: UiConfig;
  status: AppConfigStatus;
}

// ─── Selection ────────────────────────────────────────────

export interface SelectionInfo {
  quote: string;
  range: AnnotationRange;
  rect: { top: number; left: number; bottom: number; width: number };
}

// ─── Return / Write-back ──────────────────────────────────

export interface ReturnBatch {
  id: string;
  annotationIds: string[];
  prompt: string;
  createdAt: string;
  status: "pending" | "written" | "clipboard";
}
