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

export async function buildSessionReviewSnapshot(
  session: SessionRecord,
): Promise<ReviewSnapshot> {
  if (!session.documentPath) {
    return {
      annotations: session.annotations,
    };
  }

  const { baseName, parentPath } = getPathInfo(session.documentPath);
  const baseDocument = {
    reviewPath: session.documentPath,
    workspacePath: parentPath,
    archivedSubmission: null,
    documentId: baseName || session.documentPath,
    isReadOnly: false,
  } satisfies ReviewDocumentPatch;

  if (!isTauriRuntime()) {
    return {
      annotations: session.annotations,
      document: baseDocument,
    };
  }

  try {
    const { readFile } = await import("@/services/tauri-ipc");
    const content = await readFile(session.documentPath);
    return {
      annotations: session.annotations,
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
    return {
      annotations: session.annotations,
      document: baseDocument,
    };
  }
}

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
