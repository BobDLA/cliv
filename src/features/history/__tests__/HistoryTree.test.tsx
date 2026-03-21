import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HistoryTree } from "@/features/history";
import {
  useAnnotationStore,
  useDocumentStore,
  useHistoryStore,
  useReturnStore,
  useSelectionStore,
  useUIStore,
} from "@/stores";

const listReviewHistoryMock = vi.fn();
const loadReviewArchiveMock = vi.fn();

vi.mock("@/services/historyService", () => ({
  listReviewHistory: (...args: unknown[]) => listReviewHistoryMock(...args),
  loadReviewArchive: (...args: unknown[]) => loadReviewArchiveMock(...args),
}));

describe("HistoryTree", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useHistoryStore.setState({
      groups: [],
      query: "",
      isLoading: false,
      error: null,
      currentArchiveRef: null,
    });
    useAnnotationStore.getState().clearAnnotations();
    useSelectionStore.getState().reset();
    useReturnStore.getState().reset();
    useDocumentStore.setState({
      replyContent: "# live document",
      targetContent: null,
      targetPath: "/tmp/compose.md",
      reviewPath: "/tmp/live.md",
      replyPath: "/tmp/live.md",
      workspacePath: "/tmp/live",
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

  it("loads grouped history and opens an archive as read-only replay", async () => {
    listReviewHistoryMock.mockResolvedValue([
      {
        key: "ws_project",
        label: "project",
        path: "/tmp/project",
        entries: [
          {
            id: "arch_1",
            workspaceKey: "ws_project",
            workspaceLabel: "project",
            workspacePath: "/tmp/project",
            archivedAt: "2026-03-22T10:01:00.000Z",
            agent: "codex",
            reviewPath: "/tmp/project/reply.md",
            replyPath: "/tmp/project/reply.md",
            targetPath: "/tmp/project/compose.md",
            submittedChars: 128,
            itemCount: 3,
            preview: "Review feedback",
            searchText: "review feedback",
          },
        ],
      },
    ]);
    loadReviewArchiveMock.mockResolvedValue({
      summary: {
        id: "arch_1",
        workspaceKey: "ws_project",
        workspaceLabel: "project",
        workspacePath: "/tmp/project",
        archivedAt: "2026-03-22T10:01:00.000Z",
        agent: "codex",
        reviewPath: "/tmp/project/reply.md",
        replyPath: "/tmp/project/reply.md",
        targetPath: "/tmp/project/compose.md",
        submittedChars: 128,
        itemCount: 3,
        preview: "Review feedback",
        searchText: "review feedback",
      },
      replyContent: "# Archived reply\n\nBody",
      annotations: [
        {
          id: "ann-1",
          documentId: "arch_1",
          quote: "Body",
          comment: "Need more detail",
          kind: "comment",
          status: "open",
          createdAt: "2026-03-22T10:00:00.000Z",
          range: {
            startOffset: 17,
            endOffset: 21,
          },
        },
      ],
      submission: null,
      targetBefore: null,
    });

    render(<HistoryTree />);

    await screen.findByText("project");
    fireEvent.click(screen.getByTestId("history-entry"));

    await waitFor(() => {
      expect(loadReviewArchiveMock).toHaveBeenCalledWith("ws_project", "arch_1");
    });

    expect(useDocumentStore.getState().replyContent).toBe("# Archived reply\n\nBody");
    expect(useDocumentStore.getState().isReadOnly).toBe(true);
    expect(useAnnotationStore.getState().annotations).toHaveLength(1);
    expect(useHistoryStore.getState().currentArchiveRef).toEqual({
      workspaceKey: "ws_project",
      archiveId: "arch_1",
    });
  });

  it("filters entries by archived search text", async () => {
    listReviewHistoryMock.mockResolvedValue([
      {
        key: "ws_project",
        label: "project",
        path: "/tmp/project",
        entries: [
          {
            id: "arch_1",
            workspaceKey: "ws_project",
            workspaceLabel: "project",
            workspacePath: "/tmp/project",
            archivedAt: "2026-03-22T10:01:00.000Z",
            agent: "codex",
            reviewPath: null,
            replyPath: null,
            targetPath: null,
            submittedChars: 128,
            itemCount: 3,
            preview: "Detail review",
            searchText: "detail review important comment",
          },
          {
            id: "arch_2",
            workspaceKey: "ws_project",
            workspaceLabel: "project",
            workspacePath: "/tmp/project",
            archivedAt: "2026-03-22T09:01:00.000Z",
            agent: "codex",
            reviewPath: null,
            replyPath: null,
            targetPath: null,
            submittedChars: 64,
            itemCount: 1,
            preview: "Other note",
            searchText: "other note",
          },
        ],
      },
    ]);

    render(<HistoryTree />);
    await screen.findByText("project");

    fireEvent.change(screen.getByTestId("history-search-input"), {
      target: { value: "important" },
    });

    expect(screen.getAllByTestId("history-entry")).toHaveLength(1);
    expect(screen.getByText("Detail review")).toBeInTheDocument();
  });
});
