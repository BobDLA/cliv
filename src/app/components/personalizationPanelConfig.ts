import type { PromptConfig, ShortcutCommand, ShortcutConfig } from "@/types";

export type SettingsTab = "reading" | "prompts" | "shortcuts" | "integrations";
type PromptFieldKey = keyof PromptConfig;

export const TABS: SettingsTab[] = [
  "reading",
  "prompts",
  "shortcuts",
  "integrations",
];

export const SHORTCUT_FIELDS: Array<{
  command: ShortcutCommand;
  labelKey: string;
  descKey: string;
}> = [
  {
    command: "openFile",
    labelKey: "settings.shortcuts.openFile",
    descKey: "settings.shortcuts.openFileDesc",
  },
  {
    command: "search",
    labelKey: "settings.shortcuts.search",
    descKey: "settings.shortcuts.searchDesc",
  },
  {
    command: "submitReturn",
    labelKey: "settings.shortcuts.submitReturn",
    descKey: "settings.shortcuts.submitReturnDesc",
  },
  {
    command: "submitAnnotation",
    labelKey: "settings.shortcuts.submitAnnotation",
    descKey: "settings.shortcuts.submitAnnotationDesc",
  },
  {
    command: "addAnnotation",
    labelKey: "settings.shortcuts.addAnnotation",
    descKey: "settings.shortcuts.addAnnotationDesc",
  },
  {
    command: "fontIncrease",
    labelKey: "settings.shortcuts.fontIncrease",
    descKey: "settings.shortcuts.fontIncreaseDesc",
  },
  {
    command: "fontDecrease",
    labelKey: "settings.shortcuts.fontDecrease",
    descKey: "settings.shortcuts.fontDecreaseDesc",
  },
  {
    command: "fontReset",
    labelKey: "settings.shortcuts.fontReset",
    descKey: "settings.shortcuts.fontResetDesc",
  },
];

export const EMPTY_PROMPTS: PromptConfig = {
  replyHeaderZh: null,
  replyHeaderEn: null,
  iterateHeaderZh: null,
  iterateHeaderEn: null,
};

export const PROMPT_FIELDS: Array<{
  key: PromptFieldKey;
  labelKey: string;
  locale: "zh" | "en";
  mode: "reply" | "iterate";
}> = [
  {
    key: "replyHeaderZh",
    labelKey: "settings.prompts.replyHeaderZh",
    locale: "zh",
    mode: "reply",
  },
  {
    key: "replyHeaderEn",
    labelKey: "settings.prompts.replyHeaderEn",
    locale: "en",
    mode: "reply",
  },
  {
    key: "iterateHeaderZh",
    labelKey: "settings.prompts.iterateHeaderZh",
    locale: "zh",
    mode: "iterate",
  },
  {
    key: "iterateHeaderEn",
    labelKey: "settings.prompts.iterateHeaderEn",
    locale: "en",
    mode: "iterate",
  },
];

export function normalizePromptDraft(draft: PromptConfig): PromptConfig {
  const normalize = (value: string | null) => {
    const trimmed = value?.trim() ?? "";
    return trimmed ? trimmed : null;
  };

  return {
    replyHeaderZh: normalize(draft.replyHeaderZh),
    replyHeaderEn: normalize(draft.replyHeaderEn),
    iterateHeaderZh: normalize(draft.iterateHeaderZh),
    iterateHeaderEn: normalize(draft.iterateHeaderEn),
  };
}

export function clonePromptConfig(
  prompts: PromptConfig | null | undefined,
): PromptConfig {
  return {
    replyHeaderZh: prompts?.replyHeaderZh ?? null,
    replyHeaderEn: prompts?.replyHeaderEn ?? null,
    iterateHeaderZh: prompts?.iterateHeaderZh ?? null,
    iterateHeaderEn: prompts?.iterateHeaderEn ?? null,
  };
}

export function cloneShortcutConfig(shortcuts: ShortcutConfig): ShortcutConfig {
  return { ...shortcuts };
}
