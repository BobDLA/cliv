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

function getLineRange(text: string, startOffset?: number, endOffset?: number): [number, number] | null {
  if (startOffset == null || endOffset == null || !text) return null;
  const prefix = text.slice(0, startOffset);
  const startLine = (prefix.match(/\n/g) || []).length + 1;
  const selection = text.slice(startOffset, endOffset);
  const lineCount = (selection.match(/\n/g) || []).length;
  return [startLine, startLine + lineCount];
}

/**
 * Build an aggregated prompt from selected annotations.
 * Output is proper Markdown with # headings, suitable for AI agents.
 *
 * @param annotations — must be pre-sorted by document order
 * @param locale — 'zh' | 'en', defaults to 'zh'
 * @param promptConfig — optional prompt config overrides
 * @param replyContent — raw reply text, used to compute line numbers from annotation offsets
 * @returns formatted markdown prompt string
 */
export function buildPrompt(
  annotations: Annotation[],
  locale: Locale = "zh",
  promptConfig?: PromptConfig | null,
  replyContent?: string | null,
): string {
  if (annotations.length === 0) return "";

  const header = `# ${resolvePromptHeader(locale, "reply", promptConfig)}`;

  const items = annotations.map((ann, i) => {
    const num = i + 1;
    const kindKey = PROMPT_KIND_KEYS[ann.kind] ?? ann.kind;
    const kind = t(locale, kindKey);
    const quote = ann.quote.trim();
    const comment = ann.comment.trim();

    let linesInfo = "";
    if (replyContent && ann.range) {
      const lines = getLineRange(replyContent, ann.range.startOffset, ann.range.endOffset);
      if (lines) {
        if (lines[0] === lines[1]) {
          linesInfo = t(locale, "prompt.lineNumber", lines[0]);
        } else {
          linesInfo = t(locale, "prompt.lineRange", `${lines[0]}-${lines[1]}`);
        }
      }
    }

    const formattedQuote = quote.split('\n').join('\n> ');

    return [
      `## ${t(locale, "prompt.annotationHeading", num)}`,
      "",
      `**${t(locale, "prompt.type")}**: ${kind}`,
      "",
      `**${t(locale, "prompt.originalText")}**${linesInfo}:`,
      `> ${formattedQuote}`,
      "",
      `**${t(locale, "prompt.comment")}**:`,
      comment,
    ].join("\n");
  });

  return header + "\n\n" + items.join("\n\n---\n\n");
}
