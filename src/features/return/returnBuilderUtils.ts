import { messages, type Locale } from "@/lib/locales";
import { resolvePromptHeader } from "@/lib/promptTemplates";
import type { Annotation, PromptConfig } from "@/types";

export type TemplateMode = "reply" | "iterate";

export const TEMPLATE_LABELS: Record<
  TemplateMode,
  { labelKey: string; descKey: string }
> = {
  reply: { labelKey: "return.replyMode", descKey: "return.replyDesc" },
  iterate: { labelKey: "return.iterateMode", descKey: "return.iterateDesc" },
};

export const PROMPT_KIND_KEYS: Record<string, string> = {
  comment: "prompt.kindComment",
  question: "prompt.kindQuestion",
  rewrite: "prompt.kindRewrite",
  challenge: "prompt.kindChallenge",
};

const HEADER_SOURCE_LOCALES: readonly Locale[] = ["en", "zh"];
const HEADER_SOURCE_MODES: readonly TemplateMode[] = ["reply", "iterate"];

export function translateMessage(
  locale: Locale,
  key: string,
  n?: number | string,
): string {
  const template = messages[locale]?.[key] ?? messages.en?.[key] ?? key;
  if (n === undefined) {
    return template;
  }
  return template.replace("{n}", String(n));
}

function getLineRange(
  text: string,
  startOffset?: number,
  endOffset?: number,
): [number, number] | null {
  if (startOffset == null || endOffset == null || !text) {
    return null;
  }

  const prefix = text.slice(0, startOffset);
  const startLine = (prefix.match(/\n/g) || []).length + 1;
  const selection = text.slice(startOffset, endOffset);
  const lineCount = (selection.match(/\n/g) || []).length;

  return [startLine, startLine + lineCount];
}

export function buildAnnotationPrompt(
  selectedAnnotations: Annotation[],
  contentLocale: Locale,
  replyContent?: string | null,
): string {
  if (selectedAnnotations.length === 0) {
    return "";
  }

  const items = selectedAnnotations.map((annotation, index) => {
    const kindKey = PROMPT_KIND_KEYS[annotation.kind] ?? annotation.kind;
    const kind = translateMessage(contentLocale, kindKey);

    let linesInfo = "";
    if (replyContent && annotation.range) {
      const lines = getLineRange(
        replyContent,
        annotation.range.startOffset,
        annotation.range.endOffset,
      );
      if (lines) {
        linesInfo =
          lines[0] === lines[1]
            ? translateMessage(contentLocale, "prompt.lineNumber", lines[0])
            : translateMessage(
                contentLocale,
                "prompt.lineRange",
                `${lines[0]}-${lines[1]}`,
              );
      }
    }

    const formattedQuote = annotation.quote.trim().split("\n").join("\n> ");

    return [
      `## ${translateMessage(contentLocale, "prompt.annotationHeading", index + 1)}`,
      "",
      `**${translateMessage(contentLocale, "prompt.type")}**: ${kind}`,
      "",
      `**${translateMessage(contentLocale, "prompt.originalText")}**${linesInfo}:`,
      `> ${formattedQuote}`,
      "",
      `**${translateMessage(contentLocale, "prompt.comment")}**:`,
      annotation.comment.trim(),
    ].join("\n");
  });

  return items.join("\n\n---\n\n");
}

export function resolveUserTextSeed(
  locale: Locale,
  mode: TemplateMode,
  promptConfig: PromptConfig | null,
  targetContent?: string | null,
): string {
  const header = resolvePromptHeader(locale, mode, promptConfig).trim();
  const existingTargetText = stripLeadingPromptHeader(targetContent, promptConfig);

  if (!existingTargetText) {
    return header;
  }

  return `${header}\n\n${existingTargetText}`;
}

export function stripLeadingPromptHeader(
  targetContent: string | null | undefined,
  promptConfig: PromptConfig | null,
): string {
  const existingTargetText = targetContent?.trim();
  if (!existingTargetText) {
    return "";
  }

  const knownHeaders = new Set<string>();
  for (const locale of HEADER_SOURCE_LOCALES) {
    for (const mode of HEADER_SOURCE_MODES) {
      const header = resolvePromptHeader(locale, mode, promptConfig).trim();
      if (header) {
        knownHeaders.add(header);
      }
    }
  }

  for (const header of knownHeaders) {
    if (existingTargetText === header) {
      return "";
    }
    if (existingTargetText.startsWith(header)) {
      return existingTargetText.slice(header.length).trimStart();
    }
  }

  return existingTargetText;
}

export function normalizeTemplateMode(
  mode: string | null | undefined,
): TemplateMode {
  return mode === "iterate" ? "iterate" : "reply";
}

export function clearTimeoutRef(ref: { current: number | null }) {
  if (ref.current == null) {
    return;
  }

  window.clearTimeout(ref.current);
  ref.current = null;
}
