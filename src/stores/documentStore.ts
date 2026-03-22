import { create } from "zustand";
import type { SubmissionRecord } from "@/types";

// ─── Document Store ───────────────────────────────────────

interface DocumentState {
  replyContent: string | null;
  targetContent: string | null;
  targetPath: string | null;
  reviewPath: string | null;
  replyPath: string | null;
  workspacePath: string | null;
  archivedSubmission: SubmissionRecord | null;
  documentId: string;
  isReadOnly: boolean;
  isLoading: boolean;
  error: string | null;

  setDocument: (opts: {
    reply?: string | null;
    target?: string | null;
    targetPath?: string | null;
    reviewPath?: string | null;
    replyPath?: string | null;
    workspacePath?: string | null;
    archivedSubmission?: SubmissionRecord | null;
    documentId?: string;
    isReadOnly?: boolean;
  }) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useDocumentStore = create<DocumentState>((set) => ({
  replyContent: null,
  targetContent: null,
  targetPath: null,
  reviewPath: null,
  replyPath: null,
  workspacePath: null,
  archivedSubmission: null,
  documentId: "default",
  isReadOnly: false,
  isLoading: false,
  error: null,

  setDocument: (opts) =>
    set((state) => ({
      ...state,
      replyContent:
        opts.reply !== undefined ? opts.reply : state.replyContent,
      targetContent:
        opts.target !== undefined ? opts.target : state.targetContent,
      targetPath:
        opts.targetPath !== undefined ? opts.targetPath : state.targetPath,
      reviewPath:
        opts.reviewPath !== undefined ? opts.reviewPath : state.reviewPath,
      replyPath:
        opts.replyPath !== undefined ? opts.replyPath : state.replyPath,
      workspacePath:
        opts.workspacePath !== undefined
          ? opts.workspacePath
          : state.workspacePath,
      archivedSubmission:
        opts.archivedSubmission !== undefined
          ? opts.archivedSubmission
          : state.archivedSubmission,
      documentId:
        opts.documentId !== undefined ? opts.documentId : state.documentId,
      isReadOnly:
        opts.isReadOnly !== undefined ? opts.isReadOnly : state.isReadOnly,
      error: null,
    })),

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
}));
