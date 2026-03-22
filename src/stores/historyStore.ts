import { create } from "zustand";
import {
  loadReviewArchive,
  listReviewHistory,
} from "@/services/historyService";
import type { HistoryWorkspaceGroup } from "@/types";
import {
  useAnnotationStore,
} from "./annotationStore";
import { useDocumentStore } from "./documentStore";
import { useReturnStore } from "./returnStore";
import { useSelectionStore } from "./selectionStore";

interface HistoryState {
  groups: HistoryWorkspaceGroup[];
  query: string;
  isLoading: boolean;
  error: string | null;
  currentArchiveRef: { workspaceKey: string; archiveId: string } | null;

  refreshHistory: () => Promise<void>;
  setQuery: (query: string) => void;
  openArchive: (workspaceKey: string, archiveId: string) => Promise<boolean>;
}

export const useHistoryStore = create<HistoryState>((set) => ({
  groups: [],
  query: "",
  isLoading: false,
  error: null,
  currentArchiveRef: null,

  refreshHistory: async () => {
    set({ isLoading: true, error: null });
    try {
      const groups = await listReviewHistory();
      set({ groups, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : String(error),
        isLoading: false,
      });
    }
  },

  setQuery: (query) => set({ query }),

  openArchive: async (workspaceKey, archiveId) => {
    set({ isLoading: true, error: null });
    try {
      const archive = await loadReviewArchive(workspaceKey, archiveId);
      if (!archive) {
        set({ isLoading: false });
        return false;
      }

      useSelectionStore.getState().reset();
      useReturnStore.getState().reset();
      useAnnotationStore.getState().clearAnnotations();
      useAnnotationStore.getState().setAnnotations(archive.annotations);
      useDocumentStore.getState().setDocument({
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
      });

      set({
        currentArchiveRef: { workspaceKey, archiveId },
        isLoading: false,
      });
      return true;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : String(error),
        isLoading: false,
      });
      return false;
    }
  },
}));
