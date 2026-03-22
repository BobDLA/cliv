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
      archivedSubmission: null,
      documentId: "doc-1",
      isReadOnly: false,
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

  it("archives standalone open-file reviews under the opened file folder", async () => {
    writeBackMock.mockResolvedValue("clipboard");
    saveReviewArchiveMock.mockResolvedValue(undefined);

    act(() => {
      useDocumentStore.getState().setDocument({
        reply: "# Opened file reply",
        target: null,
        targetPath: null,
        reviewPath: "/tmp/other-project/reply.md",
        replyPath: "/tmp/other-project/reply.md",
        workspacePath: "/tmp/current-launch",
      });
      useAnnotationStore.getState().addAnnotation({
        id: "ann-standalone",
        documentId: "doc-1",
        quote: "reply",
        comment: "group by file folder",
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
      expect(saveReviewArchiveMock).toHaveBeenCalledWith(
        expect.objectContaining({
          workspacePath: "/tmp/other-project",
          reviewPath: "/tmp/other-project/reply.md",
          replyPath: "/tmp/other-project/reply.md",
          targetPath: null,
        }),
      );
    });
  });

  it("restores archived free-edit text and keeps replay read-only", async () => {
    act(() => {
      useDocumentStore.getState().setDocument({
        reply: "# Archived reply",
        target: "This should not replace the archive snapshot.",
        reviewPath: "/tmp/reply.md",
        replyPath: "/tmp/reply.md",
        archivedSubmission: {
          createdAt: "2026-03-22T10:01:00.000Z",
          method: "written",
          templateMode: "iterate",
          userText: "Archived custom input",
          finalOutput: "Archived custom input\n\n---\n\nArchived aggregate",
        },
        documentId: "arch-1",
        isReadOnly: true,
      });
      useAnnotationStore.getState().addAnnotation({
        id: "ann-1",
        documentId: "arch-1",
        quote: "reply",
        comment: "preserved",
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

    const textarea = screen.getByTestId("return-free-edit");

    await waitFor(() => {
      expect(textarea).toHaveValue("Archived custom input");
    });

    expect(textarea).toHaveAttribute("readonly");
    expect(screen.getByTestId("return-template-iterate")).toBeDisabled();
    expect(screen.queryByTestId("return-submit")).not.toBeInTheDocument();
    expect(screen.getByText("Viewing read-only archived review")).toBeInTheDocument();

    fireEvent.change(textarea, { target: { value: "mutated" } });
    expect(textarea).toHaveValue("Archived custom input");
  });

  it("replaces stale prompt headers instead of stacking them when switching templates", async () => {
    const replyHeader = resolvePromptHeader("en", "reply", null);
    const iterateHeader = resolvePromptHeader("en", "iterate", null);

    act(() => {
      useDocumentStore.getState().setDocument({
        target: `${replyHeader}\n\nKeep the response focused on the failing test.`,
      });
    });

    render(<ReturnBuilder />);

    const textarea = screen.getByTestId("return-free-edit");
    expect(textarea).toHaveValue(
      `${replyHeader}\n\nKeep the response focused on the failing test.`,
    );

    fireEvent.click(screen.getByTestId("return-template-iterate"));

    await waitFor(() => {
      expect(textarea).toHaveValue(
        `${iterateHeader}\n\nKeep the response focused on the failing test.`,
      );
    });

    expect(textarea).not.toHaveValue(
      `${iterateHeader}\n\n${replyHeader}\n\nKeep the response focused on the failing test.`,
    );
  });
});
