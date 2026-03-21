import { describe, it, expect, vi, beforeEach } from "vitest";

const mockTauriWriteBack = vi.fn();

vi.mock("@/services/tauri-ipc", () => ({
  writeBack: mockTauriWriteBack,
}));

// Mock clipboard API
const mockWriteText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  vi.restoreAllMocks();
  mockWriteText.mockClear();
  mockTauriWriteBack.mockReset();
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: mockWriteText },
    writable: true,
    configurable: true,
  });
});

describe("writeToClipboard", () => {
  it("should call navigator.clipboard.writeText", async () => {
    const { writeToClipboard } = await import("@/services/writeBack");
    await writeToClipboard("test content");
    expect(mockWriteText).toHaveBeenCalledWith("test content");
  });

  it("should throw if clipboard API is not available", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      writable: true,
      configurable: true,
    });
    const { writeToClipboard } = await import("@/services/writeBack");
    await expect(writeToClipboard("test")).rejects.toThrow("剪贴板 API 不可用");
  });
});

describe("writeBack", () => {
  it("should fallback to clipboard in browser environment", async () => {
    const { writeBack } = await import("@/services/writeBack");
    const method = await writeBack("test content", null);
    expect(method).toBe("clipboard");
    expect(mockWriteText).toHaveBeenCalledWith("test content");
  });

  it("should fallback to clipboard when no targetPath provided", async () => {
    const { writeBack } = await import("@/services/writeBack");
    const method = await writeBack("content");
    expect(method).toBe("clipboard");
    expect(mockWriteText).toHaveBeenCalledWith("content");
  });

  it("should write to file in Tauri when targetPath is provided", async () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      value: {},
      configurable: true,
    });
    mockTauriWriteBack.mockResolvedValue(undefined);

    vi.resetModules();
    const { writeBack } = await import("@/services/writeBack");
    const method = await writeBack("content", "/tmp/target.md");

    expect(method).toBe("written");
    expect(mockTauriWriteBack).toHaveBeenCalledWith("/tmp/target.md", "content");
    expect(mockWriteText).not.toHaveBeenCalled();

    Reflect.deleteProperty(window, "__TAURI_INTERNALS__");
  });

  it("should fallback to clipboard when Tauri file write fails", async () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      value: {},
      configurable: true,
    });
    mockTauriWriteBack.mockRejectedValue(new Error("disk full"));

    vi.resetModules();
    const { writeBack } = await import("@/services/writeBack");
    const method = await writeBack("content", "/tmp/target.md");

    expect(method).toBe("clipboard");
    expect(mockTauriWriteBack).toHaveBeenCalledWith("/tmp/target.md", "content");
    expect(mockWriteText).toHaveBeenCalledWith("content");

    Reflect.deleteProperty(window, "__TAURI_INTERNALS__");
  });
});
