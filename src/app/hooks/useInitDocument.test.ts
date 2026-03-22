import { describe, expect, it } from "vitest";
import { shouldUseReplyExtractionFallback } from "@/app/hooks/useInitDocument";

describe("shouldUseReplyExtractionFallback", () => {
  it("returns false for plain direct launches without agent context", () => {
    expect(
      shouldUseReplyExtractionFallback({
        agent: null,
        trustedCaller: null,
      }),
    ).toBe(false);
  });

  it("returns true when an agent was detected", () => {
    expect(
      shouldUseReplyExtractionFallback({
        agent: "codex",
        trustedCaller: null,
      }),
    ).toBe(true);
  });

  it("returns true when launched from a trusted caller flow", () => {
    expect(
      shouldUseReplyExtractionFallback({
        agent: null,
        trustedCaller: "cursor",
      }),
    ).toBe(true);
  });
});
