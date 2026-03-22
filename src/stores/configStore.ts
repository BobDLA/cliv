import { create } from "zustand";
import { saveAppConfig as persistAppConfig } from "@/services/tauri-ipc";
import type {
  AppConfig,
  AppConfigStatus,
  PromptConfig,
  SaveAppConfigInput,
  UiConfig,
} from "@/types";

const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

interface ConfigState {
  appConfig: AppConfig | null;
  promptConfig: PromptConfig | null;
  configStatus: AppConfigStatus | null;
  setAppConfig: (config: AppConfig | null) => void;
  savePromptConfig: (prompts: PromptConfig) => Promise<AppConfig | null>;
  saveUiConfig: (ui: UiConfig) => Promise<AppConfig | null>;
}

async function saveConfigPatch(input: SaveAppConfigInput): Promise<AppConfig | null> {
  if (!isTauri) return null;

  const nextConfig = await persistAppConfig(input);
  useConfigStore.getState().setAppConfig(nextConfig);
  return nextConfig;
}

export const useConfigStore = create<ConfigState>((set) => ({
  appConfig: null,
  promptConfig: null,
  configStatus: null,
  setAppConfig: (appConfig) =>
    set({
      appConfig,
      promptConfig: appConfig?.prompts ?? null,
      configStatus: appConfig?.status ?? null,
    }),
  savePromptConfig: async (prompts) => saveConfigPatch({ prompts }),
  saveUiConfig: async (ui) => saveConfigPatch({ ui }),
}));
