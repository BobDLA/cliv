import { create } from "zustand";

// ─── Document Store ───────────────────────────────────────

interface DocumentState {
  replyContent: string | null;
  targetContent: string | null;
  targetPath: string | null;
  reviewPath: string | null;
  replyPath: string | null;
  documentId: string;
  isLoading: boolean;
  error: string | null;

  setDocument: (opts: {
    reply?: string | null;
    target?: string | null;
    targetPath?: string | null;
    reviewPath?: string | null;
    replyPath?: string | null;
    documentId?: string;
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
  documentId: "default",
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
      documentId:
        opts.documentId !== undefined ? opts.documentId : state.documentId,
      error: null,
    })),

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
}));
