import { describe, it, expect } from "vitest";
import { buildPrompt } from "@/services/promptBuilder";
import type { Annotation } from "@/types";

function makeAnnotation(overrides: Partial<Annotation> = {}): Annotation {
  return {
    id: "test-1",
    documentId: "doc-1",
    quote: "原文片段",
    comment: "我的批注",
    kind: "comment",
    status: "open",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("buildPrompt", () => {
  it("should return empty string for empty array", () => {
    expect(buildPrompt([])).toBe("");
  });

  it("should format a single annotation correctly", () => {
    const result = buildPrompt([makeAnnotation()]);
    expect(result).toContain("[1] 原文：");
    expect(result).toContain("> 原文片段");
    expect(result).toContain("批注（评论）：");
    expect(result).toContain("我的批注");
  });

  it("should format multiple annotations with correct numbering", () => {
    const result = buildPrompt([
      makeAnnotation({ id: "a1", quote: "第一段", comment: "批注A" }),
      makeAnnotation({ id: "a2", quote: "第二段", comment: "批注B" }),
    ]);
    expect(result).toContain("[1] 原文：");
    expect(result).toContain("[2] 原文：");
    expect(result).toContain("> 第一段");
    expect(result).toContain("> 第二段");
  });

  it("should map all 4 kind labels correctly", () => {
    const kinds: Array<{ kind: Annotation["kind"]; label: string }> = [
      { kind: "comment", label: "评论" },
      { kind: "question", label: "提问" },
      { kind: "rewrite", label: "改写" },
      { kind: "challenge", label: "质疑" },
    ];

    for (const { kind, label } of kinds) {
      const result = buildPrompt([makeAnnotation({ kind })]);
      expect(result).toContain(`批注（${label}）：`);
    }
  });

  it("should include the instructional header", () => {
    const result = buildPrompt([makeAnnotation()]);
    expect(result).toContain("请基于以下批注逐条回应");
    expect(result).toContain("不要重写未标注的部分");
  });

  it("should trim whitespace from quotes and comments", () => {
    const result = buildPrompt([
      makeAnnotation({ quote: "  有空格  ", comment: "  有空格  " }),
    ]);
    expect(result).toContain("> 有空格");
    expect(result).not.toContain("  有空格  ");
  });
});
