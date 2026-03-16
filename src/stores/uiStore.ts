import { create } from "zustand";
import type { Theme } from "@/types";

// ─── Persistence Keys ─────────────────────────────────────
const STORAGE_PREFIX = "cliv:";
const KEY_FONT_SIZE = `${STORAGE_PREFIX}fontSize`;
const KEY_THEME = `${STORAGE_PREFIX}theme`;

function loadNumber(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      const n = Number(raw);
      if (!Number.isNaN(n)) return n;
    }
  } catch { /* SSR / test guard */ }
  return fallback;
}

function loadString<T extends string>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) return raw as T;
  } catch { /* SSR / test guard */ }
  return fallback;
}

function persist(key: string, value: string | number): void {
  try { localStorage.setItem(key, String(value)); } catch { /* ignore */ }
}

// ─── UI Store ─────────────────────────────────────────────

interface UIState {
  theme: Theme;
  fontSize: number;
  isFullscreen: boolean;
  setTheme: (theme: Theme) => void;
  setFontSize: (size: number) => void;
  adjustFontSize: (delta: number) => void;
  toggleFullscreen: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  theme: loadString<Theme>(KEY_THEME, "light"),
  fontSize: loadNumber(KEY_FONT_SIZE, 14),
  isFullscreen: false,

  setTheme: (theme) => {
    document.documentElement.setAttribute("data-theme", theme);
    persist(KEY_THEME, theme);
    set({ theme });
  },

  setFontSize: (fontSize) => {
    document.documentElement.style.setProperty(
      "--font-scale",
      `${fontSize}px`,
    );
    persist(KEY_FONT_SIZE, fontSize);
    set({ fontSize });
  },

  adjustFontSize: (delta) =>
    set((state) => {
      const next = Math.max(10, Math.min(24, state.fontSize + delta));
      document.documentElement.style.setProperty(
        "--font-scale",
        `${next}px`,
      );
      persist(KEY_FONT_SIZE, next);
      return { fontSize: next };
    }),

  toggleFullscreen: () => set((s) => ({ isFullscreen: !s.isFullscreen })),
}));
