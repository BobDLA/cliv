import { describe, expect, it } from "vitest";
import { shouldUseReplyExtractionFallback } from "@/app/hooks/useInitDocument";

describe("shouldUseReplyExtractionFallback", () => {
  it("returns false without agent context", () => {
    expect(
      shouldUseReplyExtractionFallback({
        agent: null,
      }),
    ).toBe(false);
  });

  it("returns true when an agent was detected", () => {
    expect(
      shouldUseReplyExtractionFallback({
        agent: "codex",
      }),
    ).toBe(true);
  });
});
