import { describe, it, expect, vi, beforeEach } from "vitest";
import { writeToClipboard, writeBack } from "@/services/writeBack";

// Mock clipboard API
const mockWriteText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: mockWriteText },
    writable: true,
    configurable: true,
  });
});

describe("writeToClipboard", () => {
  it("should call navigator.clipboard.writeText", async () => {
    await writeToClipboard("test content");
    expect(mockWriteText).toHaveBeenCalledWith("test content");
  });

  it("should throw if clipboard API is not available", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      writable: true,
      configurable: true,
    });
    await expect(writeToClipboard("test")).rejects.toThrow("剪贴板 API 不可用");
  });
});

describe("writeBack", () => {
  it("should fallback to clipboard in browser environment", async () => {
    // In browser (non-Tauri), writeBack should always use clipboard
    const method = await writeBack("test content", null);
    expect(method).toBe("clipboard");
    expect(mockWriteText).toHaveBeenCalledWith("test content");
  });

  it("should fallback to clipboard when no composePath provided", async () => {
    const method = await writeBack("content");
    expect(method).toBe("clipboard");
    expect(mockWriteText).toHaveBeenCalledWith("content");
  });
});
