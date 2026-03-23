import { describe, expect, it } from "vitest";
import { buildAnnotationPrompt } from "@/features/return/returnBuilderUtils";
import type { Annotation } from "@/types";

describe("returnBuilderUtils", () => {
  it("formats annotation prompts with stable line metadata and quoted blocks", () => {
    const annotations: Annotation[] = [
      {
        id: "ann-1",
        documentId: "doc-1",
        quote: "first line\nsecond line",
        comment: "Needs a tighter conclusion",
        kind: "comment",
        status: "open",
        createdAt: "2026-03-23T10:00:00.000Z",
        range: {
          startOffset: 0,
          endOffset: 22,
        },
      },
    ];

    expect(
      buildAnnotationPrompt(annotations, "en", "first line\nsecond line\nthird line"),
    ).toContain("**Original Text** (Lines 1-2):\n> first line\n> second line");
  });
});
