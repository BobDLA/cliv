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
const saveReviewArchiveMock = vi.fn();
const listReviewHistoryMock = vi.fn();

vi.mock("@/services/writeBack", () => ({
  writeBack: (...args: unknown[]) => writeBackMock(...args),
  closeWindow: (...args: unknown[]) => closeWindowMock(...args),
}));

vi.mock("@/services/historyService", () => ({
  saveReviewArchive: (...args: unknown[]) => saveReviewArchiveMock(...args),
  listReviewHistory: (...args: unknown[]) => listReviewHistoryMock(...args),
  loadReviewArchive: vi.fn(),
}));

describe("ReturnBuilder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    listReviewHistoryMock.mockResolvedValue([]);

    useAnnotationStore.getState().clearAnnotations();
    useReturnStore.getState().reset();
    useConfigStore.setState({ appConfig: null, promptConfig: null });
    useDocumentStore.setState({
      replyContent: null,
      targetContent: null,
      targetPath: "/tmp/compose.md",
      reviewPath: null,
      replyPath: null,
      workspacePath: "/tmp/workspace",
      documentId: "doc-1",
      isReadOnly: false,
      isLoading: false,
      error: null,
    });
    useUIStore.setState({
      theme: "light",
      fontSize: 18,
      isFullscreen: false,
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
    saveReviewArchiveMock.mockResolvedValue(undefined);

    act(() => {
      useDocumentStore.getState().setDocument({
        target: "Keep the response focused on the failing test.",
        reply: "# Current reply",
        reviewPath: "/tmp/reply.md",
        replyPath: "/tmp/reply.md",
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

    await waitFor(() => {
      expect(saveReviewArchiveMock).toHaveBeenCalledWith(
        expect.objectContaining({
          workspacePath: "/tmp/workspace",
          reviewPath: "/tmp/reply.md",
          replyPath: "/tmp/reply.md",
          targetPath: "/tmp/compose.md",
          replyContent: "# Current reply",
          targetBefore: "Keep the response focused on the failing test.",
          submission: expect.objectContaining({
            method: "written",
            templateMode: "reply",
            finalOutput: `${header}\n\nKeep the response focused on the failing test.`,
          }),
        }),
      );
    });
  });

  it("does not save a review archive when write-back fails", async () => {
    writeBackMock.mockRejectedValue(new Error("disk full"));
    saveReviewArchiveMock.mockResolvedValue(undefined);

    act(() => {
      useDocumentStore.getState().setDocument({
        reply: "# Current reply",
        reviewPath: "/tmp/reply.md",
        replyPath: "/tmp/reply.md",
      });
      useAnnotationStore.getState().addAnnotation({
        id: "ann-1",
        documentId: "doc-1",
        quote: "reply",
        comment: "needs work",
        kind: "comment",
        status: "open",
        createdAt: new Date().toISOString(),
        range: {
          startOffset: 2,
          endOffset: 7,
        },
      });
    });

    render(<ReturnBuilder />);
    fireEvent.click(screen.getByTestId("return-submit"));

    await waitFor(() => {
      expect(writeBackMock).toHaveBeenCalled();
    });

    expect(saveReviewArchiveMock).not.toHaveBeenCalled();
  });
});
