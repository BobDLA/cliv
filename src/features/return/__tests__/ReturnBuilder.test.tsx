import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReturnBuilder } from "@/features/return/ReturnBuilder";
import { resolvePromptHeader } from "@/lib/promptTemplates";
import {
  useAnnotationStore,
  useConfigStore,
  useDocumentStore,
  useReturnStore,
  useUIStore,
} from "@/stores";

const writeBackMock = vi.fn();
const closeWindowMock = vi.fn();

vi.mock("@/services/writeBack", () => ({
  writeBack: (...args: unknown[]) => writeBackMock(...args),
  closeWindow: (...args: unknown[]) => closeWindowMock(...args),
}));

describe("ReturnBuilder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    useAnnotationStore.getState().clearAnnotations();
    useReturnStore.getState().reset();
    useConfigStore.setState({ appConfig: null, promptConfig: null });
    useDocumentStore.setState({
      replyContent: null,
      targetContent: null,
      targetPath: "/tmp/compose.md",
      reviewPath: null,
      replyPath: null,
      documentId: "doc-1",
      isLoading: false,
      error: null,
    });
    useUIStore.setState({
      theme: "light",
      fontSize: 18,
      locale: "en",
    });
  });

  it("moves existing target text into the free-edit area when target content arrives", async () => {
    render(<ReturnBuilder />);

    const textarea = screen.getByTestId("return-free-edit");
    const header = resolvePromptHeader("en", "reply", null);

    expect(textarea).toHaveValue(header);

    act(() => {
      useDocumentStore.getState().setDocument({
        target: "Keep the response focused on the failing test.",
      });
    });

    await waitFor(() => {
      expect(textarea).toHaveValue(
        `${header}\n\nKeep the response focused on the failing test.`,
      );
    });
  });

  it("writes back seeded target text instead of overwriting it", async () => {
    const header = resolvePromptHeader("en", "reply", null);
    writeBackMock.mockResolvedValue("written");

    act(() => {
      useDocumentStore.getState().setDocument({
        target: "Keep the response focused on the failing test.",
      });
    });

    render(<ReturnBuilder />);
    fireEvent.click(screen.getByTestId("return-submit"));

    await waitFor(() => {
      expect(writeBackMock).toHaveBeenCalledWith(
        `${header}\n\nKeep the response focused on the failing test.`,
        "/tmp/compose.md",
      );
    });
  });
});
