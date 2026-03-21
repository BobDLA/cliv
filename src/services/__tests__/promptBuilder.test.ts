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

  it("should format a single annotation with markdown headings (zh)", () => {
    const result = buildPrompt([makeAnnotation()]);
    expect(result).toContain("# 请基于以下批注逐条回应");
    expect(result).toContain("## 批注 1");
    expect(result).toContain("**类型**: 评论");
    expect(result).toContain("**原文**:");
    expect(result).toContain("> 原文片段");
    expect(result).toContain("**批注**:");
    expect(result).toContain("我的批注");
  });

  it("should format a single annotation with markdown headings (en)", () => {
    const result = buildPrompt([makeAnnotation()], "en");
    expect(result).toContain("# Please respond to each annotation below");
    expect(result).toContain("## Annotation 1");
    expect(result).toContain("**Type**: Comment");
    expect(result).toContain("**Original Text**:");
    expect(result).toContain("> 原文片段");
    expect(result).toContain("**Annotation**:");
    expect(result).toContain("我的批注");
  });

  it("should format multiple annotations with correct numbering", () => {
    const result = buildPrompt([
      makeAnnotation({ id: "a1", quote: "第一段", comment: "批注A" }),
      makeAnnotation({ id: "a2", quote: "第二段", comment: "批注B" }),
    ]);
    expect(result).toContain("## 批注 1");
    expect(result).toContain("## 批注 2");
    expect(result).toContain("> 第一段");
    expect(result).toContain("> 第二段");
    // Annotations separated by horizontal rule
    expect(result).toContain("---");
  });

  it("should map all 4 kind labels correctly (zh)", () => {
    const kinds: Array<{ kind: Annotation["kind"]; label: string }> = [
      { kind: "comment", label: "评论" },
      { kind: "question", label: "提问" },
      { kind: "rewrite", label: "改写" },
      { kind: "challenge", label: "质疑" },
    ];

    for (const { kind, label } of kinds) {
      const result = buildPrompt([makeAnnotation({ kind })]);
      expect(result).toContain(`**类型**: ${label}`);
    }
  });

  it("should map all 4 kind labels correctly (en)", () => {
    const kinds: Array<{ kind: Annotation["kind"]; label: string }> = [
      { kind: "comment", label: "Comment" },
      { kind: "question", label: "Question" },
      { kind: "rewrite", label: "Rewrite" },
      { kind: "challenge", label: "Challenge" },
    ];

    for (const { kind, label } of kinds) {
      const result = buildPrompt([makeAnnotation({ kind })], "en");
      expect(result).toContain(`**Type**: ${label}`);
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

  it("should use configured prompt header overrides when provided", () => {
    const result = buildPrompt([makeAnnotation()], "zh", {
      replyHeaderZh: "请按自定义模板回复。",
      replyHeaderEn: null,
      iterateHeaderZh: null,
      iterateHeaderEn: null,
    });

    expect(result).toContain("# 请按自定义模板回复。");
  });

  it("should use the english reply header override when provided", () => {
    const result = buildPrompt([makeAnnotation()], "en", {
      replyHeaderZh: null,
      replyHeaderEn: "Use this custom English header.",
      iterateHeaderZh: null,
      iterateHeaderEn: null,
    });

    expect(result).toContain("# Use this custom English header.");
  });
});
