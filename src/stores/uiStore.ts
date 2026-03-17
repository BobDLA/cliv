import { create } from "zustand";
import type { Theme } from "@/types";
import { type Locale, detectLocale } from "@/lib/locales";

// ─── Persistence Keys ─────────────────────────────────────
const STORAGE_PREFIX = "cliv:";
const KEY_FONT_SIZE = `${STORAGE_PREFIX}fontSize`;
const KEY_THEME = `${STORAGE_PREFIX}theme`;
const KEY_LOCALE = `${STORAGE_PREFIX}locale`;

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
  locale: Locale;
  setTheme: (theme: Theme) => void;
  setFontSize: (size: number) => void;
  adjustFontSize: (delta: number) => void;
  toggleFullscreen: () => void;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  theme: loadString<Theme>(KEY_THEME, "light"),
  fontSize: loadNumber(KEY_FONT_SIZE, 18),
  isFullscreen: false,
  locale: loadString<Locale>(KEY_LOCALE, detectLocale()),

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

  setLocale: (locale) => {
    persist(KEY_LOCALE, locale);
    set({ locale });
  },

  toggleLocale: () =>
    set((s) => {
      const next: Locale = s.locale === "zh" ? "en" : "zh";
      persist(KEY_LOCALE, next);
      return { locale: next };
    }),
}));
