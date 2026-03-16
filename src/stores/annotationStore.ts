import { create } from "zustand";
import type { Annotation } from "@/types";

// ─── Annotation Store ─────────────────────────────────────

interface AnnotationState {
  annotations: Annotation[];
  activeAnnotationId: string | null;
  hoveredAnnotationId: string | null;
  editingAnnotationId: string | null;

  addAnnotation: (annotation: Annotation) => void;
  updateAnnotation: (id: string, patch: Partial<Annotation>) => void;
  removeAnnotation: (id: string) => void;
  setActiveAnnotation: (id: string | null) => void;
  setHoveredAnnotation: (id: string | null) => void;
  setEditingAnnotation: (id: string | null) => void;
  setAnnotations: (annotations: Annotation[]) => void;
  clearAnnotations: () => void;
}

export const useAnnotationStore = create<AnnotationState>((set) => ({
  annotations: [],
  activeAnnotationId: null,
  hoveredAnnotationId: null,
  editingAnnotationId: null,

  addAnnotation: (annotation) =>
    set((state) => ({
      annotations: [...state.annotations, annotation],
    })),

  updateAnnotation: (id, patch) =>
    set((state) => ({
      annotations: state.annotations.map((a) =>
        a.id === id ? { ...a, ...patch } : a,
      ),
    })),

  removeAnnotation: (id) =>
    set((state) => ({
      annotations: state.annotations.filter((a) => a.id !== id),
      activeAnnotationId:
        state.activeAnnotationId === id ? null : state.activeAnnotationId,
      hoveredAnnotationId:
        state.hoveredAnnotationId === id ? null : state.hoveredAnnotationId,
      editingAnnotationId:
        state.editingAnnotationId === id ? null : state.editingAnnotationId,
    })),

  setActiveAnnotation: (id) => set({ activeAnnotationId: id }),
  setHoveredAnnotation: (id) => set({ hoveredAnnotationId: id }),
  setEditingAnnotation: (id) => set({ editingAnnotationId: id }),

  setAnnotations: (annotations) => set({ annotations }),

  clearAnnotations: () =>
    set({
      annotations: [],
      activeAnnotationId: null,
      hoveredAnnotationId: null,
      editingAnnotationId: null,
    }),
}));
