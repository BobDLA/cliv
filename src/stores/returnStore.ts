import { create } from "zustand";

// ─── Return Store ─────────────────────────────────────────

export type ReturnStatus = "idle" | "previewing" | "writing" | "done" | "error";

interface ReturnState {
  selectedAnnotationIds: Set<string>;
  returnStatus: ReturnStatus;
  returnError: string | null;
  showReturnPanel: boolean;

  toggleSelect: (id: string) => void;
  selectAll: (ids: string[]) => void;
  deselectAll: () => void;
  setReturnStatus: (status: ReturnStatus, error?: string | null) => void;
  setShowReturnPanel: (show: boolean) => void;
  reset: () => void;
}

export const useReturnStore = create<ReturnState>((set) => ({
  selectedAnnotationIds: new Set(),
  returnStatus: "idle",
  returnError: null,
  showReturnPanel: false,

  toggleSelect: (id) =>
    set((state) => {
      const next = new Set(state.selectedAnnotationIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedAnnotationIds: next };
    }),

  selectAll: (ids) =>
    set({ selectedAnnotationIds: new Set(ids) }),

  deselectAll: () =>
    set({ selectedAnnotationIds: new Set() }),

  setReturnStatus: (returnStatus, returnError = null) =>
    set({ returnStatus, returnError }),

  setShowReturnPanel: (showReturnPanel) =>
    set({ showReturnPanel }),

  reset: () =>
    set({
      selectedAnnotationIds: new Set(),
      returnStatus: "idle",
      returnError: null,
      showReturnPanel: false,
    }),
}));
