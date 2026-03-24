import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, waitFor } from "@testing-library/react";
import { useInitDocument } from "@/app/hooks/useInitDocument";
import { DEFAULT_SHORTCUTS } from "@/lib/shortcuts";
import {
  useAnnotationStore,
  useConfigStore,
  useDocumentStore,
  useUIStore,
} from "@/stores";
import type { AppConfig, CliArgs, LoadResult } from "@/types";

const tauriIpc = vi.hoisted(() => {
  const win = globalThis.window as Window & typeof globalThis;
  Object.defineProperty(win, "__TAURI_INTERNALS__", {
    value: {},
    configurable: true,
  });

  return {
    getAppConfig: vi.fn(),
    getCliArgs: vi.fn(),
    loadFiles: vi.fn(),
    extractCodexReply: vi.fn(),
    extractClaudeReply: vi.fn(),
    extractGeminiReply: vi.fn(),
    saveAppConfig: vi.fn(),
  };
});

vi.mock("@/services/tauri-ipc", () => ({
  getAppConfig: tauriIpc.getAppConfig,
  getCliArgs: tauriIpc.getCliArgs,
  loadFiles: tauriIpc.loadFiles,
  extractCodexReply: tauriIpc.extractCodexReply,
  extractClaudeReply: tauriIpc.extractClaudeReply,
  extractGeminiReply: tauriIpc.extractGeminiReply,
  saveAppConfig: tauriIpc.saveAppConfig,
}));

function InitDocumentHarness() {
  useInitDocument();
  return null;
}

type AppConfigOverrides = Partial<Omit<AppConfig, "ui" | "status">> & {
  ui?: Partial<AppConfig["ui"]>;
  status?: Partial<AppConfig["status"]>;
};

function makeAppConfig(overrides?: AppConfigOverrides): AppConfig {
  const defaults: AppConfig = {
    launch: {
      scanDepth: 5,
      trustedCallers: ["codex", "claude", "gemini"],
      ignoredCallers: ["bash", "sh"],
    },
    prompts: {
      replyHeaderZh: null,
      replyHeaderEn: null,
      iterateHeaderZh: null,
      iterateHeaderEn: null,
    },
    ui: {
      theme: "light",
      fontSize: 18,
      locale: "en",
      sidebarOpen: true,
      sidebarTab: "outline",
      sidebarWidth: 224,
      annotationMarginWidth: 256,
      contentWidth: "standard",
      pagePadding: "comfortable",
      readingDensity: "comfortable",
      highlightStrength: "balanced",
      shortcuts: { ...DEFAULT_SHORTCUTS },
    },
    status: {
      path: "~/.cliv/config.toml",
      exists: true,
      launchConfigured: true,
      promptsConfigured: true,
      uiConfigured: true,
    },
  };

  return {
    ...defaults,
    ...overrides,
    ui: {
      ...defaults.ui,
      ...overrides?.ui,
    },
    status: {
      ...defaults.status,
      ...overrides?.status,
    },
  };
}

function makeCliArgs(overrides?: Partial<CliArgs>): CliArgs {
  return {
    reviewPath: null,
    targetPath: null,
    metadataPath: null,
    filePath: null,
    workspacePath: null,
    agent: null,
    trustedCaller: null,
    ...overrides,
  };
}

function makeLoadResult(overrides?: Partial<LoadResult>): LoadResult {
  return {
    target: null,
    reply: null,
    metadata: null,
    targetPath: null,
    reviewPath: null,
    replyPath: null,
    error: null,
    ...overrides,
  };
}

describe("useInitDocument in Tauri mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    useAnnotationStore.setState({
      annotations: [
        {
          id: "stale-note",
          documentId: "previous-doc",
          quote: "stale quote",
          comment: "stale comment",
          kind: "comment",
          status: "open",
          createdAt: "2026-03-23T00:00:00.000Z",
        },
      ],
      activeAnnotationId: "stale-note",
      hoveredAnnotationId: "stale-note",
      editingAnnotationId: "stale-note",
    });
    useConfigStore.getState().setAppConfig(null);
    useDocumentStore.setState({
      replyContent: null,
      targetContent: null,
      targetPath: null,
      reviewPath: null,
      replyPath: null,
      workspacePath: null,
      archivedSubmission: null,
      documentId: "default",
      isReadOnly: false,
      isLoading: false,
      error: null,
    });
    useUIStore.getState().resetPreferences();
    useUIStore.setState({ locale: "en" });

    tauriIpc.getAppConfig.mockResolvedValue(makeAppConfig());
    tauriIpc.saveAppConfig.mockResolvedValue(makeAppConfig());
    tauriIpc.loadFiles.mockResolvedValue(makeLoadResult());
    tauriIpc.extractCodexReply.mockResolvedValue("Codex cached reply");
    tauriIpc.extractClaudeReply.mockResolvedValue("Claude cached reply");
    tauriIpc.extractGeminiReply.mockResolvedValue("Gemini cached reply");
  });

  afterAll(() => {
    Reflect.deleteProperty(window, "__TAURI_INTERNALS__");
  });

  it("stays blank on a plain direct launch when loadFiles returns no reply", async () => {
    tauriIpc.getCliArgs.mockResolvedValue(
      makeCliArgs({
        filePath: "/tmp/direct.md",
        reviewPath: "/tmp/direct.md",
      }),
    );
    tauriIpc.loadFiles.mockResolvedValue(
      makeLoadResult({
        reviewPath: "/tmp/direct.md",
        reply: null,
      }),
    );

    render(<InitDocumentHarness />);

    await waitFor(() => {
      expect(useDocumentStore.getState().reviewPath).toBe("/tmp/direct.md");
    });

    expect(useDocumentStore.getState().replyContent).toBeNull();
    expect(useDocumentStore.getState().documentId).toBe("/tmp/direct.md");
    expect(useAnnotationStore.getState().annotations).toHaveLength(0);
    expect(tauriIpc.extractClaudeReply).not.toHaveBeenCalled();
    expect(tauriIpc.extractGeminiReply).not.toHaveBeenCalled();
    expect(tauriIpc.extractCodexReply).not.toHaveBeenCalled();
  });

  it("does not extract cached reply for trusted-caller-only launches", async () => {
    tauriIpc.getCliArgs.mockResolvedValue(
      makeCliArgs({
        reviewPath: "/tmp/review.md",
        workspacePath: "/tmp/project",
        trustedCaller: "zed",
      }),
    );
    tauriIpc.loadFiles.mockResolvedValue(
      makeLoadResult({
        reviewPath: "/tmp/review.md",
        replyPath: "/tmp/review.md",
        reply: "   ",
      }),
    );

    render(<InitDocumentHarness />);

    await waitFor(() => {
      expect(useDocumentStore.getState().reviewPath).toBe("/tmp/review.md");
    });

    expect(useDocumentStore.getState().replyContent).toBe("   ");
    expect(tauriIpc.extractClaudeReply).not.toHaveBeenCalled();
    expect(tauriIpc.extractGeminiReply).not.toHaveBeenCalled();
    expect(tauriIpc.extractCodexReply).not.toHaveBeenCalled();
    expect(useDocumentStore.getState().workspacePath).toBe("/tmp");
  });

  it("only tries the detected agent extractor and fails closed on miss", async () => {
    tauriIpc.getCliArgs.mockResolvedValue(
      makeCliArgs({
        filePath: "/tmp/review.md",
        reviewPath: "/tmp/review.md",
        workspacePath: "/tmp/project",
        agent: "gemini",
      }),
    );
    tauriIpc.loadFiles.mockResolvedValue(
      makeLoadResult({
        reviewPath: "/tmp/review.md",
        replyPath: "/tmp/review.md",
        reply: "",
      }),
    );
    tauriIpc.extractGeminiReply.mockResolvedValue("   ");
    tauriIpc.extractClaudeReply.mockResolvedValue("Claude fallback reply");

    render(<InitDocumentHarness />);

    await waitFor(() => {
      expect(useDocumentStore.getState().reviewPath).toBe("/tmp/review.md");
    });

    expect(useDocumentStore.getState().replyContent).toBe("");
    expect(tauriIpc.extractGeminiReply).toHaveBeenCalledWith(null);
    expect(tauriIpc.extractClaudeReply).not.toHaveBeenCalled();
    expect(tauriIpc.extractCodexReply).not.toHaveBeenCalled();
  });

  it("does not reload the Tauri document when locale changes locally", async () => {
    tauriIpc.getCliArgs.mockResolvedValue(
      makeCliArgs({
        reviewPath: "/tmp/review.md",
      }),
    );
    tauriIpc.loadFiles.mockResolvedValue(
      makeLoadResult({
        reviewPath: "/tmp/review.md",
        reply: "Initial reply",
      }),
    );

    render(<InitDocumentHarness />);

    await waitFor(() => {
      expect(useDocumentStore.getState().replyContent).toBe("Initial reply");
    });

    expect(tauriIpc.getAppConfig).toHaveBeenCalledTimes(1);
    expect(tauriIpc.loadFiles).toHaveBeenCalledTimes(1);

    act(() => {
      useUIStore.getState().setLocale("zh");
    });

    await waitFor(() => {
      expect(useUIStore.getState().locale).toBe("zh");
    });

    expect(tauriIpc.getAppConfig).toHaveBeenCalledTimes(1);
    expect(tauriIpc.loadFiles).toHaveBeenCalledTimes(1);
  });

  it("rehydrates fetched UI config when the Tauri view remounts", async () => {
    tauriIpc.getCliArgs.mockResolvedValue(
      makeCliArgs({
        reviewPath: "/tmp/review.md",
      }),
    );
    tauriIpc.loadFiles.mockResolvedValue(
      makeLoadResult({
        reviewPath: "/tmp/review.md",
        reply: "Initial reply",
      }),
    );
    tauriIpc.getAppConfig
      .mockResolvedValueOnce(
        makeAppConfig({
          ui: {
            theme: "light",
            locale: "en",
          },
        }),
      )
      .mockResolvedValueOnce(
        makeAppConfig({
          ui: {
            theme: "dark",
            locale: "zh",
          },
        }),
      );

    const firstRender = render(<InitDocumentHarness />);

    await waitFor(() => {
      expect(useUIStore.getState().theme).toBe("light");
    });

    firstRender.unmount();

    render(<InitDocumentHarness />);

    await waitFor(() => {
      expect(useUIStore.getState().theme).toBe("dark");
    });

    expect(useUIStore.getState().locale).toBe("zh");
    expect(tauriIpc.getAppConfig).toHaveBeenCalledTimes(2);
    expect(tauriIpc.loadFiles).toHaveBeenCalledTimes(2);
  });
});
