import { create } from "zustand";
import { useSessionStore } from "./sessionStore";
import {
  loadReviewArchive,
  listReviewHistory,
} from "@/services/historyService";
import {
  applyReviewSnapshot,
  beginReviewRestoreRequest,
  buildArchiveReviewSnapshot,
  isCurrentReviewRestoreRequest,
} from "@/services/reviewSnapshot";
import type { HistoryWorkspaceGroup } from "@/types";

let currentArchiveOpenRequestId = 0;

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
    currentArchiveOpenRequestId += 1;
    const archiveOpenRequestId = currentArchiveOpenRequestId;
    const requestId = beginReviewRestoreRequest();
    set({ isLoading: true, error: null });
    try {
      const archive = await loadReviewArchive(workspaceKey, archiveId);
      if (!isCurrentReviewRestoreRequest(requestId)) {
        if (currentArchiveOpenRequestId === archiveOpenRequestId) {
          set({ isLoading: false });
        }
        return false;
      }
      if (!archive) {
        set({ isLoading: false });
        return false;
      }

      applyReviewSnapshot(buildArchiveReviewSnapshot(archive));
      useSessionStore.setState({ currentSessionId: null });

      set({
        currentArchiveRef: { workspaceKey, archiveId },
        isLoading: false,
      });
      return true;
    } catch (error) {
      if (!isCurrentReviewRestoreRequest(requestId)) {
        if (currentArchiveOpenRequestId === archiveOpenRequestId) {
          set({ isLoading: false });
        }
        return false;
      }
      set({
        error: error instanceof Error ? error.message : String(error),
        isLoading: false,
      });
      return false;
    }
  },
}));
