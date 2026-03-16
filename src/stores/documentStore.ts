import { create } from "zustand";

// ─── Document Store ───────────────────────────────────────

interface DocumentState {
  replyContent: string | null;
  composeContent: string | null;
  composePath: string | null;
  replyPath: string | null;
  documentId: string;
  isLoading: boolean;
  error: string | null;

  setDocument: (opts: {
    reply?: string | null;
    compose?: string | null;
    composePath?: string | null;
    replyPath?: string | null;
    documentId?: string;
  }) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useDocumentStore = create<DocumentState>((set) => ({
  replyContent: null,
  composeContent: null,
  composePath: null,
  replyPath: null,
  documentId: "default",
  isLoading: false,
  error: null,

  setDocument: (opts) =>
    set((state) => ({
      ...state,
      replyContent: opts.reply ?? state.replyContent,
      composeContent: opts.compose ?? state.composeContent,
      composePath: opts.composePath ?? state.composePath,
      replyPath: opts.replyPath ?? state.replyPath,
      documentId: opts.documentId ?? state.documentId,
      error: null,
    })),

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
}));
