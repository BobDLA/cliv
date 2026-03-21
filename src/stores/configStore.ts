import { create } from "zustand";
import type { AppConfig, PromptConfig } from "@/types";

interface ConfigState {
  appConfig: AppConfig | null;
  promptConfig: PromptConfig | null;
  setAppConfig: (config: AppConfig | null) => void;
}

export const useConfigStore = create<ConfigState>((set) => ({
  appConfig: null,
  promptConfig: null,
  setAppConfig: (appConfig) =>
    set({
      appConfig,
      promptConfig: appConfig?.prompts ?? null,
    }),
}));
