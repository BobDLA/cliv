import { create } from "zustand";
import type { AnnotationKind, SelectionInfo } from "@/types";

// ─── Selection Store ──────────────────────────────────────

interface SelectionState {
  selection: SelectionInfo | null;
  showPopup: boolean;
  popupKind: AnnotationKind;

  setSelection: (sel: SelectionInfo | null) => void;
  openPopup: () => void;
  closePopup: () => void;
  setPopupKind: (kind: AnnotationKind) => void;
  reset: () => void;
}

export const useSelectionStore = create<SelectionState>((set) => ({
  selection: null,
  showPopup: false,
  popupKind: "comment",

  setSelection: (selection) => set({ selection }),
  openPopup: () => set({ showPopup: true }),
  closePopup: () => {
    set({ showPopup: false });
    // Clear selection on next tick so submit can still read it
    setTimeout(() => set({ selection: null }), 0);
  },
  setPopupKind: (popupKind) => set({ popupKind }),
  reset: () => set({ selection: null, showPopup: false, popupKind: "comment" }),
}));
