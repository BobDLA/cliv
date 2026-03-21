import type { Annotation } from "@/types";
import { type Locale, messages } from "@/lib/locales";
import type { PromptConfig } from "@/types";
import { resolvePromptHeader } from "@/lib/promptTemplates";

/** Resolve a i18n key for the given locale, with optional {n} interpolation */
function t(locale: Locale, key: string, n?: number | string): string {
  const str = messages[locale]?.[key] ?? messages.en?.[key] ?? key;
  if (n !== undefined) return str.replace("{n}", String(n));
  return str;
}

const PROMPT_KIND_KEYS: Record<string, string> = {
  comment: "prompt.kindComment",
  question: "prompt.kindQuestion",
  rewrite: "prompt.kindRewrite",
  challenge: "prompt.kindChallenge",
};

/**
 * Build an aggregated prompt from selected annotations.
 * Output is proper Markdown with # headings, suitable for AI agents.
 *
 * @param annotations — must be pre-sorted by document order
 * @param locale — 'zh' | 'en', defaults to 'zh'
 * @returns formatted markdown prompt string
 */
export function buildPrompt(
  annotations: Annotation[],
  locale: Locale = "zh",
  promptConfig?: PromptConfig | null,
): string {
  if (annotations.length === 0) return "";

  const header = `# ${resolvePromptHeader(locale, "reply", promptConfig)}`;

  const items = annotations.map((ann, i) => {
    const num = i + 1;
    const kindKey = PROMPT_KIND_KEYS[ann.kind] ?? ann.kind;
    const kind = t(locale, kindKey);
    const quote = ann.quote.trim();
    const comment = ann.comment.trim();

    return [
      `## ${t(locale, "prompt.annotationHeading", num)}`,
      "",
      `**${t(locale, "prompt.type")}**: ${kind}`,
      "",
      `**${t(locale, "prompt.originalText")}**:`,
      `> ${quote}`,
      "",
      `**${t(locale, "prompt.comment")}**:`,
      comment,
    ].join("\n");
  });

  return header + "\n\n" + items.join("\n\n---\n\n");
}
