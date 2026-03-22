import { describe, expect, it } from "vitest";
import { matchShortcut, parseShortcut } from "@/lib/shortcuts";

describe("shortcuts", () => {
  it("matches Mod+= when the browser reports the shifted '+' key", () => {
    expect(
      matchShortcut(
        {
          key: "+",
          ctrlKey: true,
          metaKey: false,
          altKey: false,
          shiftKey: true,
        },
        "Mod+=",
      ),
    ).toBe(true);
  });

  it("parses the plus alias to the canonical equals shortcut", () => {
    expect(parseShortcut("Mod+plus")).toMatchObject({
      canonical: "Mod+=",
      key: "=",
    });
  });
});
