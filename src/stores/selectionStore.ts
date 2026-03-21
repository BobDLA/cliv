import { create } from "zustand";
import type { AnnotationKind, SelectionInfo } from "@/types";

// ─── Selection Store ──────────────────────────────────────

interface SelectionState {
  selection: SelectionInfo | null;
  showPopup: boolean;
  popupKind: AnnotationKind;
  draftComment: string;

  setSelection: (sel: SelectionInfo | null) => void;
  openPopup: () => void;
  closePopup: () => void;
  setPopupKind: (kind: AnnotationKind) => void;
  setDraftComment: (comment: string) => void;
  reset: () => void;
}

export const useSelectionStore = create<SelectionState>((set) => ({
  selection: null,
  showPopup: false,
  popupKind: "comment",
  draftComment: "",

  setSelection: (selection) => set({ selection }),
  openPopup: () => set({ showPopup: true }),
  closePopup: () => {
    set({ showPopup: false, draftComment: "" });
    // Clear selection on next tick so submit can still read it
    setTimeout(() => set({ selection: null }), 0);
  },
  setPopupKind: (popupKind) => set({ popupKind }),
  setDraftComment: (draftComment) => set({ draftComment }),
  reset: () =>
    set({
      selection: null,
      showPopup: false,
      popupKind: "comment",
      draftComment: "",
    }),
}));
