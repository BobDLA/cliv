import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PersonalizationPanel } from "@/app/components/PersonalizationPanel";
import { DEFAULT_SHORTCUTS } from "@/lib/shortcuts";
import { useConfigStore, useUIStore } from "@/stores";
import { hydrateUIFromAppConfig } from "@/stores/uiStore";
import type { AppConfig } from "@/types";

function makeAppConfig(overrides?: Partial<AppConfig>): AppConfig {
  return {
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
    ...overrides,
  };
}

describe("PersonalizationPanel", () => {
  beforeEach(() => {
    localStorage.clear();
    useUIStore.getState().resetPreferences();
    useUIStore.setState({ locale: "en" });
    useConfigStore.setState({
      appConfig: null,
      promptConfig: null,
      configStatus: null,
      savePromptConfig: vi.fn().mockResolvedValue(null),
      saveUiConfig: vi.fn().mockResolvedValue(null),
    });
  });

  it("saves prompt edits and restores default prompt headers", async () => {
    const savePromptConfig = vi.fn().mockResolvedValue(null);
    useConfigStore.setState({ savePromptConfig });

    render(<PersonalizationPanel open onClose={() => {}} />);

    fireEvent.click(screen.getByTestId("settings-tab-prompts"));

    const textarea = screen.getByTestId("settings-prompt-replyHeaderZh");
    fireEvent.change(textarea, { target: { value: "  自定义提示头  " } });
    fireEvent.blur(textarea);

    await waitFor(() => {
      expect(savePromptConfig).toHaveBeenCalledWith({
        replyHeaderZh: "自定义提示头",
        replyHeaderEn: null,
        iterateHeaderZh: null,
        iterateHeaderEn: null,
      });
    });

    fireEvent.click(screen.getByTestId("settings-prompts-reset"));

    await waitFor(() => {
      expect(savePromptConfig).toHaveBeenLastCalledWith({
        replyHeaderZh: null,
        replyHeaderEn: null,
        iterateHeaderZh: null,
        iterateHeaderEn: null,
      });
    });
  });

  it("updates shortcut drafts, normalizes values, and resets to defaults", async () => {
    render(<PersonalizationPanel open onClose={() => {}} />);

    fireEvent.click(screen.getByTestId("settings-tab-shortcuts"));

    const input = screen.getByTestId("settings-shortcut-openFile");
    fireEvent.change(input, { target: { value: "ctrl+shift+p" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(useUIStore.getState().shortcuts.openFile).toBe("Mod+Shift+P");
    });
    expect(screen.getByTestId("settings-shortcut-openFile")).toHaveValue(
      "Mod+Shift+P",
    );

    fireEvent.click(screen.getByTestId("settings-shortcuts-reset"));

    await waitFor(() => {
      expect(useUIStore.getState().shortcuts.openFile).toBe(DEFAULT_SHORTCUTS.openFile);
      expect(useUIStore.getState().shortcuts.submitReturn).toBe(
        DEFAULT_SHORTCUTS.submitReturn,
      );
    });
  });

  it("shows hydrated shortcut values after config-backed restore", async () => {
    const config = makeAppConfig({
      ui: {
        ...makeAppConfig().ui,
        shortcuts: {
          ...DEFAULT_SHORTCUTS,
          openFile: "Mod+Shift+P",
          submitReturn: "Mod+J",
        },
      },
    });

    useConfigStore.getState().setAppConfig(config);
    hydrateUIFromAppConfig(config);

    render(<PersonalizationPanel open onClose={() => {}} />);

    fireEvent.click(screen.getByTestId("settings-tab-shortcuts"));

    expect(screen.getByTestId("settings-shortcut-openFile")).toHaveValue(
      "Mod+Shift+P",
    );
    expect(screen.getByTestId("settings-shortcut-submitReturn")).toHaveValue(
      "Mod+J",
    );
  });

  it("shows config-backed integration status and agent boundary paths", () => {
    useConfigStore.setState({
      configStatus: {
        path: "/tmp/cliv/config.toml",
        exists: true,
        launchConfigured: true,
        promptsConfigured: true,
        uiConfigured: true,
      },
    });

    render(<PersonalizationPanel open onClose={() => {}} />);

    fireEvent.click(screen.getByTestId("settings-tab-integrations"));

    expect(screen.getByText("/tmp/cliv/config.toml")).toBeInTheDocument();
    expect(
      screen.getByText(
        "cliV already has a config file on disk. Future settings changes continue to write there.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Durable UI settings for this launch came from the config file.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("External agent hook boundary")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Codex: `~/.codex/config.toml` + `~/.codex/hooks.json`",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Plan Review capture requires a trusted Stop hook; review it with `/hooks` in Codex.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Claude: `~/.claude/settings.json`"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Gemini: `~/.gemini/settings.json`"),
    ).toBeInTheDocument();
  });

  it("shows pending migration copy when config-backed UI settings are not set up yet", () => {
    useConfigStore.setState({
      configStatus: {
        path: "~/.cliv/config.toml",
        exists: false,
        launchConfigured: false,
        promptsConfigured: false,
        uiConfigured: false,
      },
    });

    render(<PersonalizationPanel open onClose={() => {}} />);

    fireEvent.click(screen.getByTestId("settings-tab-integrations"));

    expect(screen.getByText("~/.cliv/config.toml")).toBeInTheDocument();
    expect(
      screen.getByText(
        "cliV does not have a config file yet. It will be created on the first settings save.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Legacy localStorage preferences are still honored for compatibility until the first save migrates them into the unified config.",
      ),
    ).toBeInTheDocument();
  });
});
