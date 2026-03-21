import { useDocumentStore } from "@/stores";
import type { Annotation, AnnotationKind, SelectionInfo } from "@/types";

export function createAnnotationFromSelection(
  selection: SelectionInfo,
  comment: string,
  kind: AnnotationKind,
): Annotation {
  return {
    id: crypto.randomUUID(),
    documentId: useDocumentStore.getState().documentId,
    quote: selection.quote,
    comment,
    range: selection.range,
    kind,
    status: "open",
    createdAt: new Date().toISOString(),
  };
}

export function maybeCreateAnnotationFromDraft(
  selection: SelectionInfo | null,
  comment: string,
  kind: AnnotationKind,
): Annotation | null {
  const text = comment.trim();
  if (!selection || !text) return null;

  return createAnnotationFromSelection(selection, text, kind);
}
