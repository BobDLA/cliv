import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const STORAGE_KEYS = {
  theme: "cliv:theme",
  fontSize: "cliv:fontSize",
  locale: "cliv:locale",
  sidebarOpen: "cliv:sidebarOpen",
  sidebarTab: "cliv:sidebarTab",
  sidebarWidth: "cliv:sidebarWidth",
  marginWidth: "cliv:marginWidth",
  contentWidth: "cliv:contentWidth",
  pagePadding: "cliv:pagePadding",
  readingDensity: "cliv:readingDensity",
  highlightStrength: "cliv:highlightStrength",
} as const;

function clearDocumentPreferenceState() {
  const root = document.documentElement;

  root.removeAttribute("data-theme");
  root.removeAttribute("data-reading-density");
  root.removeAttribute("data-highlight-strength");

  for (const name of [
    "--font-scale",
    "--content-max-width",
    "--content-shell-padding",
    "--viewer-padding-x",
    "--viewer-padding-y",
    "--markdown-line-height",
    "--highlight-comment-alpha",
    "--highlight-question-alpha",
    "--highlight-rewrite-alpha",
    "--highlight-challenge-alpha",
    "--highlight-active-alpha",
    "--highlight-creating-alpha",
  ]) {
    root.style.removeProperty(name);
  }
}

async function loadUIStoreModule() {
  vi.resetModules();
  return import("../uiStore");
}

describe("uiStore", () => {
  beforeEach(() => {
    localStorage.clear();
    clearDocumentPreferenceState();
  });

  it("restores persisted preferences with safe clamping and enum fallbacks", async () => {
    localStorage.setItem(STORAGE_KEYS.theme, "dark");
    localStorage.setItem(STORAGE_KEYS.fontSize, "99");
    localStorage.setItem(STORAGE_KEYS.locale, "zh");
    localStorage.setItem(STORAGE_KEYS.sidebarOpen, "false");
    localStorage.setItem(STORAGE_KEYS.sidebarTab, "history");
    localStorage.setItem(STORAGE_KEYS.sidebarWidth, "999");
    localStorage.setItem(STORAGE_KEYS.marginWidth, "10");
    localStorage.setItem(STORAGE_KEYS.contentWidth, "wide");
    localStorage.setItem(STORAGE_KEYS.pagePadding, "invalid");
    localStorage.setItem(STORAGE_KEYS.readingDensity, "relaxed");
    localStorage.setItem(STORAGE_KEYS.highlightStrength, "strong");

    const {
      MARGIN_WIDTH_MIN,
      SIDEBAR_WIDTH_MAX,
      useUIStore,
    } = await loadUIStoreModule();
    const state = useUIStore.getState();

    expect(state.theme).toBe("dark");
    expect(state.fontSize).toBe(24);
    expect(state.locale).toBe("zh");
    expect(state.sidebarOpen).toBe(false);
    expect(state.sidebarTab).toBe("history");
    expect(state.sidebarWidth).toBe(SIDEBAR_WIDTH_MAX);
    expect(state.marginWidth).toBe(MARGIN_WIDTH_MIN);
    expect(state.contentWidth).toBe("wide");
    expect(state.pagePadding).toBe("comfortable");
    expect(state.readingDensity).toBe("relaxed");
    expect(state.highlightStrength).toBe("strong");
  });

  it("applies reading presentation presets to document-level CSS variables", async () => {
    const { useUIStore } = await loadUIStoreModule();

    act(() => {
      const state = useUIStore.getState();
      state.setContentWidth("narrow");
      state.setPagePadding("airy");
      state.setReadingDensity("compact");
      state.setHighlightStrength("subtle");
    });

    const root = document.documentElement;
    expect(root.style.getPropertyValue("--content-max-width")).toBe("48rem");
    expect(root.style.getPropertyValue("--content-shell-padding")).toBe("32px");
    expect(root.style.getPropertyValue("--viewer-padding-x")).toBe("64px");
    expect(root.style.getPropertyValue("--viewer-padding-y")).toBe("32px");
    expect(root.style.getPropertyValue("--markdown-line-height")).toBe("1.6");
    expect(root.style.getPropertyValue("--highlight-comment-alpha")).toBe("0.12");
    expect(root.style.getPropertyValue("--highlight-active-alpha")).toBe("0.28");
    expect(root.getAttribute("data-reading-density")).toBe("compact");
    expect(root.getAttribute("data-highlight-strength")).toBe("subtle");
    expect(localStorage.getItem(STORAGE_KEYS.contentWidth)).toBe("narrow");
    expect(localStorage.getItem(STORAGE_KEYS.pagePadding)).toBe("airy");
    expect(localStorage.getItem(STORAGE_KEYS.readingDensity)).toBe("compact");
    expect(localStorage.getItem(STORAGE_KEYS.highlightStrength)).toBe("subtle");
  });

  it("resets V1 preferences to defaults without changing fullscreen mode", async () => {
    const { useUIStore } = await loadUIStoreModule();
    const defaultLocale = navigator.language.startsWith("zh") ? "zh" : "en";

    act(() => {
      useUIStore.setState({ isFullscreen: true });
      const state = useUIStore.getState();
      state.setTheme("dark");
      state.setFontSize(22);
      state.setLocale("zh");
      state.setSidebarOpen(false);
      state.setSidebarTab("history");
      state.setSidebarWidth(320);
      state.setMarginWidth(360);
      state.setContentWidth("wide");
      state.setPagePadding("airy");
      state.setReadingDensity("relaxed");
      state.setHighlightStrength("strong");
    });

    act(() => {
      useUIStore.getState().resetPreferences();
    });

    const state = useUIStore.getState();
    expect(state.isFullscreen).toBe(true);
    expect(state.theme).toBe("light");
    expect(state.fontSize).toBe(18);
    expect(state.locale).toBe(defaultLocale);
    expect(state.sidebarOpen).toBe(true);
    expect(state.sidebarTab).toBe("outline");
    expect(state.sidebarWidth).toBe(224);
    expect(state.marginWidth).toBe(256);
    expect(state.contentWidth).toBe("standard");
    expect(state.pagePadding).toBe("comfortable");
    expect(state.readingDensity).toBe("comfortable");
    expect(state.highlightStrength).toBe("balanced");
    expect(localStorage.getItem(STORAGE_KEYS.theme)).toBe("light");
    expect(localStorage.getItem(STORAGE_KEYS.fontSize)).toBe("18");
    expect(localStorage.getItem(STORAGE_KEYS.locale)).toBe(defaultLocale);
    expect(localStorage.getItem(STORAGE_KEYS.sidebarOpen)).toBe("true");
    expect(localStorage.getItem(STORAGE_KEYS.sidebarTab)).toBe("outline");
    expect(localStorage.getItem(STORAGE_KEYS.sidebarWidth)).toBe("224");
    expect(localStorage.getItem(STORAGE_KEYS.marginWidth)).toBe("256");
    expect(localStorage.getItem(STORAGE_KEYS.contentWidth)).toBe("standard");
    expect(localStorage.getItem(STORAGE_KEYS.pagePadding)).toBe("comfortable");
    expect(localStorage.getItem(STORAGE_KEYS.readingDensity)).toBe("comfortable");
    expect(localStorage.getItem(STORAGE_KEYS.highlightStrength)).toBe("balanced");
  });
});
