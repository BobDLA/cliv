import { create } from "zustand";
import type {
  AppConfig,
  ContentWidth,
  HighlightStrength,
  PagePadding,
  ReadingDensity,
  ShortcutCommand,
  ShortcutConfig,
  SidebarTab,
  Theme,
  UiConfig,
} from "@/types";
import { type Locale, detectLocale } from "@/lib/locales";
import { getDefaultShortcuts, resolveShortcutConfig } from "@/lib/shortcuts";
import { useConfigStore } from "./configStore";

const STORAGE_PREFIX = "cliv:";
const KEY_FONT_SIZE = `${STORAGE_PREFIX}fontSize`;
const KEY_THEME = `${STORAGE_PREFIX}theme`;
const KEY_LOCALE = `${STORAGE_PREFIX}locale`;
const KEY_SIDEBAR_OPEN = `${STORAGE_PREFIX}sidebarOpen`;
const KEY_SIDEBAR_TAB = `${STORAGE_PREFIX}sidebarTab`;
const KEY_SIDEBAR_WIDTH = `${STORAGE_PREFIX}sidebarWidth`;
const KEY_MARGIN_WIDTH = `${STORAGE_PREFIX}marginWidth`;
const KEY_CONTENT_WIDTH = `${STORAGE_PREFIX}contentWidth`;
const KEY_PAGE_PADDING = `${STORAGE_PREFIX}pagePadding`;
const KEY_READING_DENSITY = `${STORAGE_PREFIX}readingDensity`;
const KEY_HIGHLIGHT_STRENGTH = `${STORAGE_PREFIX}highlightStrength`;
const LEGACY_UI_KEYS = [
  KEY_FONT_SIZE,
  KEY_THEME,
  KEY_LOCALE,
  KEY_SIDEBAR_OPEN,
  KEY_SIDEBAR_TAB,
  KEY_SIDEBAR_WIDTH,
  KEY_MARGIN_WIDTH,
  KEY_CONTENT_WIDTH,
  KEY_PAGE_PADDING,
  KEY_READING_DENSITY,
  KEY_HIGHLIGHT_STRENGTH,
] as const;

const FONT_SIZE_MIN = 10;
const FONT_SIZE_MAX = 24;
export const SIDEBAR_WIDTH_MIN = 120;
export const SIDEBAR_WIDTH_MAX = 400;
export const MARGIN_WIDTH_MIN = 150;
export const MARGIN_WIDTH_MAX = 500;

const THEMES: readonly Theme[] = ["dark", "dim", "light"];
const LOCALES: readonly Locale[] = ["zh", "en"];
const SIDEBAR_TABS: readonly SidebarTab[] = ["outline", "history"];
const CONTENT_WIDTHS: readonly ContentWidth[] = ["narrow", "standard", "wide"];
const PAGE_PADDINGS: readonly PagePadding[] = ["compact", "comfortable", "airy"];
const READING_DENSITIES: readonly ReadingDensity[] = [
  "compact",
  "comfortable",
  "relaxed",
];
const HIGHLIGHT_STRENGTHS: readonly HighlightStrength[] = [
  "subtle",
  "balanced",
  "strong",
];
const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

interface UIPreferences {
  theme: Theme;
  fontSize: number;
  locale: Locale;
  sidebarOpen: boolean;
  sidebarTab: SidebarTab;
  sidebarWidth: number;
  marginWidth: number;
  contentWidth: ContentWidth;
  pagePadding: PagePadding;
  readingDensity: ReadingDensity;
  highlightStrength: HighlightStrength;
  shortcuts: ShortcutConfig;
}

export interface UIState extends UIPreferences {
  setTheme: (theme: Theme) => void;
  setFontSize: (size: number) => void;
  adjustFontSize: (delta: number) => void;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  setSidebarOpen: (sidebarOpen: boolean) => void;
  toggleSidebarOpen: () => void;
  setSidebarTab: (sidebarTab: SidebarTab) => void;
  setSidebarWidth: (sidebarWidth: number) => void;
  setMarginWidth: (marginWidth: number) => void;
  setContentWidth: (contentWidth: ContentWidth) => void;
  setPagePadding: (pagePadding: PagePadding) => void;
  setReadingDensity: (readingDensity: ReadingDensity) => void;
  setHighlightStrength: (highlightStrength: HighlightStrength) => void;
  setShortcut: (command: ShortcutCommand, shortcut: string) => void;
  resetReadingPreferences: () => void;
  resetShortcuts: () => void;
  resetPreferences: () => void;
}

const CONTENT_WIDTH_VALUES: Record<ContentWidth, string> = {
  narrow: "48rem",
  standard: "56rem",
  wide: "64rem",
};

const PAGE_PADDING_VALUES: Record<
  PagePadding,
  { shell: string; x: string; y: string }
> = {
  compact: { shell: "16px", x: "32px", y: "20px" },
  comfortable: { shell: "24px", x: "48px", y: "24px" },
  airy: { shell: "32px", x: "64px", y: "32px" },
};

const READING_DENSITY_VALUES: Record<ReadingDensity, string> = {
  compact: "1.6",
  comfortable: "1.75",
  relaxed: "1.95",
};

const HIGHLIGHT_STRENGTH_VALUES: Record<
  HighlightStrength,
  {
    comment: string;
    question: string;
    rewrite: string;
    challenge: string;
    active: string;
    creating: string;
  }
> = {
  subtle: {
    comment: "0.12",
    question: "0.12",
    rewrite: "0.12",
    challenge: "0.12",
    active: "0.28",
    creating: "0.12",
  },
  balanced: {
    comment: "0.2",
    question: "0.2",
    rewrite: "0.2",
    challenge: "0.2",
    active: "0.4",
    creating: "0.18",
  },
  strong: {
    comment: "0.28",
    question: "0.28",
    rewrite: "0.28",
    challenge: "0.28",
    active: "0.52",
    creating: "0.24",
  },
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function clampFontSize(value: number): number {
  return clamp(value, FONT_SIZE_MIN, FONT_SIZE_MAX);
}

export function clampSidebarWidth(value: number): number {
  return clamp(value, SIDEBAR_WIDTH_MIN, SIDEBAR_WIDTH_MAX);
}

export function clampMarginWidth(value: number): number {
  return clamp(value, MARGIN_WIDTH_MIN, MARGIN_WIDTH_MAX);
}

function loadNumber(key: string, fallback: number, min?: number, max?: number): number {
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      const n = Number(raw);
      if (!Number.isNaN(n)) {
        if (min != null && max != null) return clamp(n, min, max);
        return n;
      }
    }
  } catch {
    // SSR / test guard
  }
  return fallback;
}

function loadString<T extends string>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) return raw as T;
  } catch {
    // SSR / test guard
  }
  return fallback;
}

function loadBoolean(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (raw === "true") return true;
    if (raw === "false") return false;
  } catch {
    // SSR / test guard
  }
  return fallback;
}

function loadEnum<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const value = loadString(key, fallback);
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function persist(key: string, value: string | number | boolean): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // ignore persistence failures
  }
}

function getDefaultPreferences(): UIPreferences {
  return {
    theme: "light",
    fontSize: 18,
    locale: detectLocale(),
    sidebarOpen: true,
    sidebarTab: "outline",
    sidebarWidth: 224,
    marginWidth: 256,
    contentWidth: "standard",
    pagePadding: "comfortable",
    readingDensity: "comfortable",
    highlightStrength: "balanced",
    shortcuts: getDefaultShortcuts(),
  };
}

function cloneShortcuts(shortcuts: ShortcutConfig): ShortcutConfig {
  return { ...shortcuts };
}

function loadPreferences(): UIPreferences {
  const defaults = getDefaultPreferences();

  return {
    theme: loadEnum(KEY_THEME, THEMES, defaults.theme),
    fontSize: loadNumber(KEY_FONT_SIZE, defaults.fontSize, FONT_SIZE_MIN, FONT_SIZE_MAX),
    locale: loadEnum(KEY_LOCALE, LOCALES, defaults.locale),
    sidebarOpen: loadBoolean(KEY_SIDEBAR_OPEN, defaults.sidebarOpen),
    sidebarTab: loadEnum(KEY_SIDEBAR_TAB, SIDEBAR_TABS, defaults.sidebarTab),
    sidebarWidth: loadNumber(
      KEY_SIDEBAR_WIDTH,
      defaults.sidebarWidth,
      SIDEBAR_WIDTH_MIN,
      SIDEBAR_WIDTH_MAX,
    ),
    marginWidth: loadNumber(
      KEY_MARGIN_WIDTH,
      defaults.marginWidth,
      MARGIN_WIDTH_MIN,
      MARGIN_WIDTH_MAX,
    ),
    contentWidth: loadEnum(KEY_CONTENT_WIDTH, CONTENT_WIDTHS, defaults.contentWidth),
    pagePadding: loadEnum(KEY_PAGE_PADDING, PAGE_PADDINGS, defaults.pagePadding),
    readingDensity: loadEnum(
      KEY_READING_DENSITY,
      READING_DENSITIES,
      defaults.readingDensity,
    ),
    highlightStrength: loadEnum(
      KEY_HIGHLIGHT_STRENGTH,
      HIGHLIGHT_STRENGTHS,
      defaults.highlightStrength,
    ),
    shortcuts: cloneShortcuts(defaults.shortcuts),
  };
}

function toUiConfig(state: UIPreferences): UiConfig {
  return {
    theme: state.theme,
    fontSize: clampFontSize(state.fontSize),
    locale: state.locale,
    sidebarOpen: state.sidebarOpen,
    sidebarTab: state.sidebarTab,
    sidebarWidth: clampSidebarWidth(state.sidebarWidth),
    annotationMarginWidth: clampMarginWidth(state.marginWidth),
    contentWidth: state.contentWidth,
    pagePadding: state.pagePadding,
    readingDensity: state.readingDensity,
    highlightStrength: state.highlightStrength,
    shortcuts: resolveShortcutConfig(state.shortcuts),
  };
}

function fromUiConfig(ui: UiConfig): UIPreferences {
  return {
    theme: THEMES.includes(ui.theme) ? ui.theme : "light",
    fontSize: clampFontSize(ui.fontSize),
    locale: LOCALES.includes(ui.locale) ? ui.locale : detectLocale(),
    sidebarOpen: ui.sidebarOpen,
    sidebarTab: SIDEBAR_TABS.includes(ui.sidebarTab) ? ui.sidebarTab : "outline",
    sidebarWidth: clampSidebarWidth(ui.sidebarWidth),
    marginWidth: clampMarginWidth(ui.annotationMarginWidth),
    contentWidth: CONTENT_WIDTHS.includes(ui.contentWidth)
      ? ui.contentWidth
      : "standard",
    pagePadding: PAGE_PADDINGS.includes(ui.pagePadding)
      ? ui.pagePadding
      : "comfortable",
    readingDensity: READING_DENSITIES.includes(ui.readingDensity)
      ? ui.readingDensity
      : "comfortable",
    highlightStrength: HIGHLIGHT_STRENGTHS.includes(ui.highlightStrength)
      ? ui.highlightStrength
      : "balanced",
    shortcuts: resolveShortcutConfig(ui.shortcuts),
  };
}

function getReadingDefaults(): Omit<UIPreferences, "shortcuts"> {
  const { shortcuts: _ignored, ...defaults } = getDefaultPreferences();
  return defaults;
}

function hasLegacyUIPreferences(): boolean {
  try {
    return LEGACY_UI_KEYS.some((key) => localStorage.getItem(key) !== null);
  } catch {
    return false;
  }
}

function applyUIPreferencesToDocument(state: UIState): void {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const padding = PAGE_PADDING_VALUES[state.pagePadding];
  const highlight = HIGHLIGHT_STRENGTH_VALUES[state.highlightStrength];

  root.setAttribute("data-theme", state.theme);
  root.setAttribute("data-reading-density", state.readingDensity);
  root.setAttribute("data-highlight-strength", state.highlightStrength);
  root.style.setProperty("--font-scale", `${state.fontSize}px`);
  root.style.setProperty("--content-max-width", CONTENT_WIDTH_VALUES[state.contentWidth]);
  root.style.setProperty("--content-shell-padding", padding.shell);
  root.style.setProperty("--viewer-padding-x", padding.x);
  root.style.setProperty("--viewer-padding-y", padding.y);
  root.style.setProperty(
    "--markdown-line-height",
    READING_DENSITY_VALUES[state.readingDensity],
  );
  root.style.setProperty("--highlight-comment-alpha", highlight.comment);
  root.style.setProperty("--highlight-question-alpha", highlight.question);
  root.style.setProperty("--highlight-rewrite-alpha", highlight.rewrite);
  root.style.setProperty("--highlight-challenge-alpha", highlight.challenge);
  root.style.setProperty("--highlight-active-alpha", highlight.active);
  root.style.setProperty("--highlight-creating-alpha", highlight.creating);
}

function persistPreferencePatch(patch: Partial<UIPreferences>): void {
  if (patch.theme !== undefined) persist(KEY_THEME, patch.theme);
  if (patch.fontSize !== undefined) persist(KEY_FONT_SIZE, patch.fontSize);
  if (patch.locale !== undefined) persist(KEY_LOCALE, patch.locale);
  if (patch.sidebarOpen !== undefined) persist(KEY_SIDEBAR_OPEN, patch.sidebarOpen);
  if (patch.sidebarTab !== undefined) persist(KEY_SIDEBAR_TAB, patch.sidebarTab);
  if (patch.sidebarWidth !== undefined) persist(KEY_SIDEBAR_WIDTH, patch.sidebarWidth);
  if (patch.marginWidth !== undefined) persist(KEY_MARGIN_WIDTH, patch.marginWidth);
  if (patch.contentWidth !== undefined) persist(KEY_CONTENT_WIDTH, patch.contentWidth);
  if (patch.pagePadding !== undefined) persist(KEY_PAGE_PADDING, patch.pagePadding);
  if (patch.readingDensity !== undefined) {
    persist(KEY_READING_DENSITY, patch.readingDensity);
  }
  if (patch.highlightStrength !== undefined) {
    persist(KEY_HIGHLIGHT_STRENGTH, patch.highlightStrength);
  }
}

const initialPreferences = loadPreferences();

export const useUIStore = create<UIState>((set) => ({
  ...initialPreferences,

  setTheme: (theme) => {
    persistPreferencePatch({ theme });
    set({ theme });
  },

  setFontSize: (fontSize) => {
    const next = clampFontSize(fontSize);
    persistPreferencePatch({ fontSize: next });
    set({ fontSize: next });
  },

  adjustFontSize: (delta) =>
    set((state) => {
      const next = clampFontSize(state.fontSize + delta);
      persistPreferencePatch({ fontSize: next });
      return { fontSize: next };
    }),

  setLocale: (locale) => {
    persistPreferencePatch({ locale });
    set({ locale });
  },

  toggleLocale: () =>
    set((state) => {
      const next: Locale = state.locale === "zh" ? "en" : "zh";
      persistPreferencePatch({ locale: next });
      return { locale: next };
    }),

  setSidebarOpen: (sidebarOpen) => {
    persistPreferencePatch({ sidebarOpen });
    set({ sidebarOpen });
  },

  toggleSidebarOpen: () =>
    set((state) => {
      const next = !state.sidebarOpen;
      persistPreferencePatch({ sidebarOpen: next });
      return { sidebarOpen: next };
    }),

  setSidebarTab: (sidebarTab) => {
    persistPreferencePatch({ sidebarTab });
    set({ sidebarTab });
  },

  setSidebarWidth: (sidebarWidth) => {
    const next = clampSidebarWidth(sidebarWidth);
    persistPreferencePatch({ sidebarWidth: next });
    set({ sidebarWidth: next });
  },

  setMarginWidth: (marginWidth) => {
    const next = clampMarginWidth(marginWidth);
    persistPreferencePatch({ marginWidth: next });
    set({ marginWidth: next });
  },

  setContentWidth: (contentWidth) => {
    persistPreferencePatch({ contentWidth });
    set({ contentWidth });
  },

  setPagePadding: (pagePadding) => {
    persistPreferencePatch({ pagePadding });
    set({ pagePadding });
  },

  setReadingDensity: (readingDensity) => {
    persistPreferencePatch({ readingDensity });
    set({ readingDensity });
  },

  setHighlightStrength: (highlightStrength) => {
    persistPreferencePatch({ highlightStrength });
    set({ highlightStrength });
  },

  setShortcut: (command, shortcut) =>
    set((state) => {
      const nextShortcuts = resolveShortcutConfig({
        ...state.shortcuts,
        [command]: shortcut,
      });
      return { shortcuts: nextShortcuts };
    }),

  resetReadingPreferences: () => {
    const defaults = getReadingDefaults();
    persistPreferencePatch(defaults);
    set(defaults);
  },

  resetShortcuts: () => {
    set({ shortcuts: getDefaultShortcuts() });
  },

  resetPreferences: () => {
    const defaults = getDefaultPreferences();
    persistPreferencePatch(defaults);
    set(defaults);
  },
}));

let hasDocumentPreferenceSubscription = false;
let hasUiConfig = false;
let isApplyingConfig = false;
let pendingPersistTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleUiConfigPersist(): void {
  if (!isTauri || !hasUiConfig || isApplyingConfig) return;

  if (pendingPersistTimer != null) {
    clearTimeout(pendingPersistTimer);
  }

  pendingPersistTimer = setTimeout(() => {
    pendingPersistTimer = null;
    const snapshot = toUiConfig(useUIStore.getState());
    void useConfigStore.getState().saveUiConfig(snapshot).catch((error) => {
      console.error("Failed to persist UI settings", error);
    });
  }, 150);
}

export function hydrateUIFromAppConfig(appConfig: AppConfig): void {
  if (appConfig.status.uiConfigured) {
    isApplyingConfig = true;
    const nextPreferences = fromUiConfig(appConfig.ui);
    persistPreferencePatch(nextPreferences);
    useUIStore.setState(nextPreferences);
    isApplyingConfig = false;
  }

  hasUiConfig = true;

  if (!appConfig.status.uiConfigured && hasLegacyUIPreferences()) {
    scheduleUiConfigPersist();
  }
}

if (typeof document !== "undefined" && !hasDocumentPreferenceSubscription) {
  hasDocumentPreferenceSubscription = true;
  applyUIPreferencesToDocument(useUIStore.getState());
  useUIStore.subscribe((state) => {
    applyUIPreferencesToDocument(state);
    scheduleUiConfigPersist();
  });
}
