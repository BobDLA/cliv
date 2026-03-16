import { describe, it, expect } from "vitest";
import { generateId, clamp } from "@/lib/utils";

describe("utils", () => {
  describe("generateId", () => {
    it("should generate unique IDs", () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });

    it("should return a non-empty string", () => {
      const id = generateId();
      expect(id).toBeTruthy();
      expect(typeof id).toBe("string");
    });
  });

  describe("clamp", () => {
    it("should return value when within range", () => {
      expect(clamp(5, 0, 10)).toBe(5);
    });

    it("should clamp to min", () => {
      expect(clamp(-5, 0, 10)).toBe(0);
    });

    it("should clamp to max", () => {
      expect(clamp(15, 0, 10)).toBe(10);
    });

    it("should handle equal min and max", () => {
      expect(clamp(5, 3, 3)).toBe(3);
    });
  });
});
