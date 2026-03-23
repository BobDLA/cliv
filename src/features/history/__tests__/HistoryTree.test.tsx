import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HistoryTree } from "@/features/history";
import * as reviewSnapshotModule from "@/services/reviewSnapshot";
import {
  useAnnotationStore,
  useDocumentStore,
  useHistoryStore,
  useReturnStore,
  useSelectionStore,
  useSessionStore,
  useUIStore,
} from "@/stores";

const listReviewHistoryMock = vi.fn();
const loadReviewArchiveMock = vi.fn();
const writeTextMock = vi.fn();

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

vi.mock("@/services/historyService", () => ({
  listReviewHistory: (...args: unknown[]) => listReviewHistoryMock(...args),
  loadReviewArchive: (...args: unknown[]) => loadReviewArchiveMock(...args),
}));

describe("HistoryTree", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    writeTextMock.mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: writeTextMock,
      },
    });

    useHistoryStore.setState({
      groups: [],
      query: "",
      isLoading: false,
      error: null,
      currentArchiveRef: null,
    });
    useSessionStore.setState({
      currentSessionId: "sess_existing",
      sessions: [],
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
      submission: {
        createdAt: "2026-03-22T10:01:00.000Z",
        method: "written",
        templateMode: "reply",
        userText: "Archived custom input",
        finalOutput: "Archived custom input",
      },
      targetBefore: null,
    });

    render(<HistoryTree />);

    await screen.findByText("project");
    expect(screen.queryByTestId("history-entry")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("history-group-toggle"));

    expect(screen.getByTestId("history-entry")).toHaveAttribute(
      "title",
      expect.stringContaining("128 chars · 3 items"),
    );
    fireEvent.click(screen.getByTestId("history-entry"));

    await waitFor(() => {
      expect(loadReviewArchiveMock).toHaveBeenCalledWith("ws_project", "arch_1");
    });

    expect(useDocumentStore.getState().replyContent).toBe("# Archived reply\n\nBody");
    expect(useDocumentStore.getState().isReadOnly).toBe(true);
    expect(useDocumentStore.getState().archivedSubmission?.userText).toBe("Archived custom input");
    expect(useAnnotationStore.getState().annotations).toHaveLength(1);
    expect(useSessionStore.getState().currentSessionId).toBeNull();
    expect(useHistoryStore.getState().currentArchiveRef).toEqual({
      workspaceKey: "ws_project",
      archiveId: "arch_1",
    });
    expect(
      screen.getByText((text) => text.includes("128 chars · 3 items")),
    ).toBeInTheDocument();
    expect(screen.queryByText("Review feedback")).not.toBeInTheDocument();
  });

  it("keeps all project groups collapsed by default until opened", async () => {
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
            searchText: "detail review",
          },
        ],
      },
      {
        key: "ws_docs",
        label: "docs",
        path: "/tmp/docs",
        entries: [
          {
            id: "arch_2",
            workspaceKey: "ws_docs",
            workspaceLabel: "docs",
            workspacePath: "/tmp/docs",
            archivedAt: "2026-03-22T09:01:00.000Z",
            agent: "codex",
            reviewPath: null,
            replyPath: null,
            targetPath: null,
            submittedChars: 64,
            itemCount: 1,
            preview: "Docs note",
            searchText: "docs note",
          },
        ],
      },
    ]);

    render(<HistoryTree />);

    await screen.findByText("project");
    expect(screen.getByText("docs")).toBeInTheDocument();
    expect(screen.queryAllByTestId("history-group-children")).toHaveLength(0);
    expect(screen.queryByTestId("history-entry")).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByTestId("history-group-toggle")[0]);

    expect(screen.getByTestId("history-group-children")).toBeInTheDocument();
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
    expect(screen.queryByTestId("history-entry")).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId("history-search-input"), {
      target: { value: "important" },
    });

    expect(screen.getAllByTestId("history-entry")).toHaveLength(1);
    expect(
      screen.getByText((text) => text.includes("128 chars · 3 items")),
    ).toBeInTheDocument();
    expect(screen.queryByText("Detail review")).not.toBeInTheDocument();
    expect(screen.queryByText((text) => text.includes("64 chars · 1 items"))).not.toBeInTheDocument();
  });

  it("shows the workspace path only on hover, supports copy, and allows collapsing", async () => {
    const longPath =
      "/mnt/hdd/work/temp/cliv/.worktrees/integration-worktree-batch-20260322/src-tauri";

    listReviewHistoryMock.mockResolvedValue([
      {
        key: "ws_src_tauri",
        label: "src-tauri",
        path: longPath,
        entries: [
          {
            id: "arch_1",
            workspaceKey: "ws_src_tauri",
            workspaceLabel: "src-tauri",
            workspacePath: longPath,
            archivedAt: "2026-03-22T10:01:00.000Z",
            agent: "codex",
            reviewPath: null,
            replyPath: null,
            targetPath: null,
            submittedChars: 367,
            itemCount: 1,
            preview: "",
            searchText: "",
          },
        ],
      },
    ]);

    render(<HistoryTree />);

    await screen.findByText("src-tauri");
    expect(screen.getByTestId("history-group-count")).toHaveTextContent("1 items");

    expect(screen.queryByTestId("history-group-path-popover")).not.toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByTestId("history-group-label"));

    const popover = await screen.findByTestId("history-group-path-popover");
    expect(popover).toHaveTextContent(longPath);

    fireEvent.click(screen.getByTestId("history-group-copy-path"));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(longPath);
    });
    expect(screen.getByText("Copied")).toBeInTheDocument();
    expect(screen.queryByTestId("history-group-children")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("history-group-toggle"));
    expect(screen.getByTestId("history-group-children")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("history-group-toggle"));
    expect(screen.queryByTestId("history-group-children")).not.toBeInTheDocument();
  });

  it("ignores a stale archive load after a newer review restore request starts", async () => {
    const archiveLoad = deferred<Awaited<ReturnType<typeof loadReviewArchiveMock>>>();
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
    loadReviewArchiveMock.mockReturnValue(archiveLoad.promise);

    render(<HistoryTree />);

    await screen.findByText("project");
    fireEvent.click(screen.getByTestId("history-group-toggle"));
    fireEvent.click(screen.getByTestId("history-entry"));

    const newerRequestId = reviewSnapshotModule.beginReviewRestoreRequest();
    expect(reviewSnapshotModule.isCurrentReviewRestoreRequest(newerRequestId)).toBe(true);

    await act(async () => {
      archiveLoad.resolve({
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
        submission: {
          createdAt: "2026-03-22T10:01:00.000Z",
          method: "written",
          templateMode: "reply",
          userText: "Archived custom input",
          finalOutput: "Archived custom input",
        },
        targetBefore: null,
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(useHistoryStore.getState().currentArchiveRef).toBeNull();
      expect(useHistoryStore.getState().isLoading).toBe(false);
      expect(useDocumentStore.getState().replyContent).toBe("# live document");
      expect(useDocumentStore.getState().isReadOnly).toBe(false);
      expect(useSessionStore.getState().currentSessionId).toBe("sess_existing");
    });
  });

  it("surfaces load failures instead of showing the generic empty history state", async () => {
    listReviewHistoryMock.mockRejectedValue(new Error("history directory unreadable"));

    render(<HistoryTree />);

    expect(await screen.findByTestId("history-tree-error")).toHaveTextContent(
      "Failed to load history",
    );
    expect(screen.getByText("history directory unreadable")).toBeInTheDocument();
    expect(screen.queryByText("No archived reviews yet")).not.toBeInTheDocument();
  });
});
