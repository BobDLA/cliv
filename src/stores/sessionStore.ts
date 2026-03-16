import { create } from "zustand";
import { useAnnotationStore } from "./annotationStore";
import {
  listSessions,
  loadSession,
  createSession,
  deleteSession,
  saveAnnotations,
  type SessionSummary,
  type SessionRecord,
} from "@/services/sessionService";

// ─── Session Store ────────────────────────────────────────

interface SessionState {
  currentSessionId: string | null;
  sessions: SessionSummary[];

  refreshSessions: () => void;
  openSession: (id: string) => SessionRecord | null;
  createNewSession: (name: string, documentPath: string | null) => string;
  deleteSessionById: (id: string) => void;
  autoSave: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  currentSessionId: null,
  sessions: [],

  refreshSessions: () => {
    set({ sessions: listSessions() });
  },

  openSession: (id) => {
    const session = loadSession(id);
    if (session) {
      set({ currentSessionId: id });
    }
    return session;
  },

  createNewSession: (name, documentPath) => {
    const annotations = useAnnotationStore.getState().annotations;
    const session = createSession(name, documentPath, annotations, []);
    set({ currentSessionId: session.id });
    get().refreshSessions();
    return session.id;
  },

  deleteSessionById: (id) => {
    deleteSession(id);
    set((state) => ({
      currentSessionId:
        state.currentSessionId === id ? null : state.currentSessionId,
    }));
    get().refreshSessions();
  },

  autoSave: () => {
    const { currentSessionId } = get();
    if (!currentSessionId) return;
    const annotations = useAnnotationStore.getState().annotations;
    saveAnnotations(currentSessionId, annotations);
    get().refreshSessions();
  },
}));
