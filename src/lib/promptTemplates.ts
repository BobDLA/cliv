import { messages, type Locale } from "@/lib/locales";
import type { PromptConfig } from "@/types";

export type PromptMode = "reply" | "iterate";

export function resolvePromptHeader(
  locale: Locale,
  mode: PromptMode,
  overrides?: PromptConfig | null,
): string {
  const configured = getConfiguredHeader(locale, mode, overrides);
  if (configured) return configured;

  const key = mode === "reply" ? "prompt.replyHeader" : "prompt.iterateHeader";
  return messages[locale]?.[key] ?? messages.en[key] ?? key;
}

function getConfiguredHeader(
  locale: Locale,
  mode: PromptMode,
  overrides?: PromptConfig | null,
): string | null {
  if (!overrides) return null;

  if (locale === "zh") {
    return mode === "reply"
      ? overrides.replyHeaderZh
      : overrides.iterateHeaderZh;
  }

  return mode === "reply"
    ? overrides.replyHeaderEn
    : overrides.iterateHeaderEn;
}
