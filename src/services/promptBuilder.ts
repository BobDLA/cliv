import type { Annotation } from "@/types";

const KIND_LABELS: Record<string, string> = {
  comment: "评论",
  question: "提问",
  rewrite: "改写",
  challenge: "质疑",
};

/**
 * Build an aggregated prompt from selected annotations.
 * Uses the template defined in architecture.md §9.5.
 *
 * @param annotations — must be pre-sorted by document order
 * @returns formatted prompt string
 */
export function buildPrompt(annotations: Annotation[]): string {
  if (annotations.length === 0) return "";

  const header =
    "请基于以下批注逐条回应。除非我明确要求，不要重写未标注的部分。\n";

  const items = annotations.map((ann, i) => {
    const num = i + 1;
    const kind = KIND_LABELS[ann.kind] ?? ann.kind;
    const quote = ann.quote.trim();
    const comment = ann.comment.trim();

    return [
      `[${num}] 原文：`,
      `> ${quote}`,
      "",
      `批注（${kind}）：`,
      comment,
    ].join("\n");
  });

  return header + "\n" + items.join("\n\n");
}
