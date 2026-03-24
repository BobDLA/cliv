import { getPathInfo } from "@/lib/pathUtils";
import { useAnnotationStore } from "@/stores/annotationStore";
import { useDocumentStore } from "@/stores/documentStore";
import { useReturnStore } from "@/stores/returnStore";
import { useSelectionStore } from "@/stores/selectionStore";
import type { ReviewArchiveData } from "@/types";
import type { SessionRecord } from "./sessionService";

interface ReviewDocumentPatch {
  reply?: string | null;
  target?: string | null;
  targetPath?: string | null;
  reviewPath?: string | null;
  replyPath?: string | null;
  workspacePath?: string | null;
  archivedSubmission?: ReviewArchiveData["submission"];
  documentId?: string;
  isReadOnly?: boolean;
}

interface ReviewSnapshot {
  annotations: SessionRecord["annotations"];
  document?: ReviewDocumentPatch;
  resetSelection?: boolean;
  resetReturnState?: boolean;
  resetAnnotationUiState?: boolean;
}

let currentReviewRestoreRequestId = 0;

export function beginReviewRestoreRequest(): number {
  currentReviewRestoreRequestId += 1;
  return currentReviewRestoreRequestId;
}

export function isCurrentReviewRestoreRequest(requestId: number): boolean {
  return currentReviewRestoreRequestId === requestId;
}

export function applyReviewSnapshot(snapshot: ReviewSnapshot): void {
  if (snapshot.resetSelection) {
    useSelectionStore.getState().reset();
  }
  if (snapshot.resetReturnState) {
    useReturnStore.getState().reset();
  }

  const annotationStore = useAnnotationStore.getState();
  if (snapshot.resetAnnotationUiState) {
    annotationStore.clearAnnotations();
  }
  annotationStore.setAnnotations(snapshot.annotations);

  if (snapshot.document) {
    useDocumentStore.getState().setDocument(snapshot.document);
  }
}

export function buildArchiveReviewSnapshot(
  archive: ReviewArchiveData,
): ReviewSnapshot {
  return {
    annotations: archive.annotations,
    document: {
      reply: archive.replyContent,
      target: null,
      targetPath: null,
      reviewPath:
        archive.summary.reviewPath ??
        archive.summary.replyPath ??
        archive.summary.workspacePath,
      replyPath: archive.summary.replyPath ?? archive.summary.reviewPath,
      workspacePath: archive.summary.workspacePath,
      archivedSubmission: archive.submission,
      documentId: archive.summary.id,
      isReadOnly: true,
    },
    resetSelection: true,
    resetReturnState: true,
    resetAnnotationUiState: true,
  };
}

export function buildPendingSessionReviewSnapshot(
  session: SessionRecord,
): ReviewSnapshot {
  const baseSnapshot = {
    annotations: session.annotations,
    resetSelection: true,
    resetReturnState: true,
    resetAnnotationUiState: true,
  } satisfies Pick<
    ReviewSnapshot,
    "annotations" | "resetSelection" | "resetReturnState" | "resetAnnotationUiState"
  >;

  if (!session.documentPath) {
    return {
      ...baseSnapshot,
      document: {
        reply: null,
        target: null,
        targetPath: null,
        reviewPath: null,
        replyPath: null,
        workspacePath: null,
        archivedSubmission: null,
        documentId: session.id,
        isReadOnly: false,
      },
    };
  }

  const { baseName, parentPath } = getPathInfo(session.documentPath);
  return {
    ...baseSnapshot,
    document: {
      reply: null,
      target: null,
      targetPath: null,
      reviewPath: session.documentPath,
      replyPath: null,
      workspacePath: parentPath,
      archivedSubmission: null,
      documentId: baseName || session.documentPath,
      isReadOnly: false,
    },
  };
}

export async function buildSessionReviewSnapshot(
  session: SessionRecord,
): Promise<ReviewSnapshot> {
  const pendingSnapshot = buildPendingSessionReviewSnapshot(session);

  if (!session.documentPath || !isTauriRuntime()) {
    return pendingSnapshot;
  }

  const { baseName, parentPath } = getPathInfo(session.documentPath);

  try {
    const { readFile } = await import("@/services/tauri-ipc");
    const content = await readFile(session.documentPath);
    return {
      ...pendingSnapshot,
      document: {
        reply: content,
        target: null,
        targetPath: null,
        reviewPath: session.documentPath,
        replyPath: session.documentPath,
        workspacePath: parentPath,
        archivedSubmission: null,
        documentId: baseName || session.documentPath,
        isReadOnly: false,
      },
    };
  } catch {
    return pendingSnapshot;
  }
}

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
