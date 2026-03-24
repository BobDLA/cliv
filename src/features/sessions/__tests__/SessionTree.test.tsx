import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionTree } from "@/features/sessions";
import * as reviewSnapshotModule from "@/services/reviewSnapshot";
import { createSession } from "@/services/sessionService";
import type { SelectionInfo } from "@/types";
import {
  useAnnotationStore,
  useDocumentStore,
  useHistoryStore,
  useReturnStore,
  useSelectionStore,
  useSessionStore,
  useUIStore,
} from "@/stores";

const tauriIpc = vi.hoisted(() => ({
  readFile: vi.fn(),
}));

vi.mock("@/services/tauri-ipc", () => ({
  readFile: tauriIpc.readFile,
}));

function enableTauriRuntime() {
  Object.defineProperty(window, "__TAURI_INTERNALS__", {
    value: {},
    configurable: true,
  });
}

function getSessionItem(id: string): HTMLElement {
  const item = document.querySelector(`[data-session-id="${id}"]`);
  if (!(item instanceof HTMLElement)) {
    throw new Error(`Missing session item for ${id}`);
  }
  return item;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("SessionTree", () => {
  beforeEach(() => {
    localStorage.clear();
    tauriIpc.readFile.mockReset();
    Reflect.deleteProperty(window, "__TAURI_INTERNALS__");

    useSessionStore.setState({
      currentSessionId: null,
      sessions: [],
    });
    useHistoryStore.setState({
      currentArchiveRef: {
        workspaceKey: "ws_archive",
        archiveId: "arch_1",
      },
      error: null,
      groups: [],
      isLoading: false,
      query: "",
    });
    useAnnotationStore.setState({
      annotations: [],
      activeAnnotationId: null,
      hoveredAnnotationId: null,
      editingAnnotationId: null,
    });
    useDocumentStore.setState({
      replyContent: "# archived reply",
      targetContent: "Old target",
      targetPath: "/tmp/compose.md",
      reviewPath: "/tmp/archive.md",
      replyPath: "/tmp/archive.md",
      workspacePath: "/tmp/archive",
      archivedSubmission: {
        createdAt: "2026-03-22T10:00:00.000Z",
        method: "written",
        templateMode: "reply",
        userText: "Old user text",
        finalOutput: "Old final output",
      },
      documentId: "archive-1",
      isReadOnly: true,
      isLoading: false,
      error: null,
    });
    useSelectionStore.setState({
      selection: {
        quote: "Old selection",
        range: { startOffset: 0, endOffset: 4 },
        rect: { top: 1, left: 2, bottom: 3, width: 4 },
      } satisfies SelectionInfo,
      showPopup: true,
      popupKind: "rewrite",
      draftComment: "stale draft",
    });
    useReturnStore.setState({
      selectedAnnotationIds: new Set(["stale-ann"]),
      returnStatus: "error",
      returnError: "stale error",
      showReturnPanel: true,
    });
    useUIStore.setState({
      theme: "light",
      fontSize: 18,
      locale: "en",
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(window, "__TAURI_INTERNALS__");
    vi.restoreAllMocks();
  });

  it("clears stale archive replay state when a saved session file cannot be read", async () => {
    enableTauriRuntime();
    tauriIpc.readFile.mockRejectedValueOnce(new Error("missing file"));

    const session = createSession(
      "Saved draft",
      "/tmp/project/reply.md",
      [
        {
          id: "ann-1",
          documentId: "doc-1",
          quote: "Body",
          comment: "Keep this editable",
          kind: "comment",
          status: "open",
          createdAt: "2026-03-22T10:00:00.000Z",
        },
      ],
      [],
    );

    render(<SessionTree />);

    await waitFor(() => {
      expect(document.querySelector(`[data-session-id="${session.id}"]`)).not.toBeNull();
    });
    fireEvent.click(getSessionItem(session.id));

    await waitFor(() => {
      expect(useSessionStore.getState().currentSessionId).toBe(session.id);
    });

    expect(tauriIpc.readFile).toHaveBeenCalledWith("/tmp/project/reply.md");
    expect(useAnnotationStore.getState().annotations).toHaveLength(1);
    expect(useDocumentStore.getState().reviewPath).toBe("/tmp/project/reply.md");
    expect(useDocumentStore.getState().workspacePath).toBe("/tmp/project");
    expect(useDocumentStore.getState().archivedSubmission).toBeNull();
    expect(useDocumentStore.getState().isReadOnly).toBe(false);
    expect(useDocumentStore.getState().replyContent).toBeNull();
    expect(useDocumentStore.getState().targetContent).toBeNull();
    expect(useDocumentStore.getState().targetPath).toBeNull();
    expect(useDocumentStore.getState().replyPath).toBeNull();
    expect(useSelectionStore.getState()).toMatchObject({
      selection: null,
      showPopup: false,
      popupKind: "comment",
      draftComment: "",
    });
    expect(useReturnStore.getState().selectedAnnotationIds.size).toBe(0);
    expect(useReturnStore.getState().returnStatus).toBe("idle");
    expect(useReturnStore.getState().returnError).toBeNull();
    expect(useReturnStore.getState().showReturnPanel).toBe(false);
    expect(useHistoryStore.getState().currentArchiveRef).toBeNull();
  });

  it("clears stale review state immediately while a saved session is still loading", async () => {
    const session = createSession(
      "Saved draft",
      "/tmp/project/reply.md",
      [
        {
          id: "ann-1",
          documentId: "doc-1",
          quote: "Body",
          comment: "Keep this editable",
          kind: "comment",
          status: "open",
          createdAt: "2026-03-22T10:00:00.000Z",
        },
      ],
      [],
    );

    const snapshot =
      deferred<Awaited<ReturnType<typeof reviewSnapshotModule.buildSessionReviewSnapshot>>>();
    vi.spyOn(reviewSnapshotModule, "buildSessionReviewSnapshot").mockReturnValue(snapshot.promise);

    render(<SessionTree />);

    await waitFor(() => {
      expect(document.querySelector(`[data-session-id="${session.id}"]`)).not.toBeNull();
    });

    fireEvent.click(getSessionItem(session.id));

    await waitFor(() => {
      expect(useSessionStore.getState().currentSessionId).toBe(session.id);
    });

    expect(useHistoryStore.getState().currentArchiveRef).toBeNull();
    expect(useAnnotationStore.getState().annotations).toHaveLength(1);
    expect(useAnnotationStore.getState().annotations[0]?.id).toBe("ann-1");
    expect(useDocumentStore.getState()).toMatchObject({
      replyContent: null,
      targetContent: null,
      targetPath: null,
      reviewPath: "/tmp/project/reply.md",
      replyPath: null,
      workspacePath: "/tmp/project",
      archivedSubmission: null,
      documentId: "reply.md",
      isReadOnly: false,
    });
    expect(useSelectionStore.getState()).toMatchObject({
      selection: null,
      showPopup: false,
      popupKind: "comment",
      draftComment: "",
    });
    expect(useReturnStore.getState().selectedAnnotationIds.size).toBe(0);
    expect(useReturnStore.getState().returnStatus).toBe("idle");
    expect(useReturnStore.getState().returnError).toBeNull();
    expect(useReturnStore.getState().showReturnPanel).toBe(false);

    await act(async () => {
      snapshot.resolve({
        annotations: session.annotations,
        resetSelection: true,
        resetReturnState: true,
        resetAnnotationUiState: true,
        document: {
          reply: "# session reply",
          target: null,
          targetPath: null,
          reviewPath: "/tmp/project/reply.md",
          replyPath: "/tmp/project/reply.md",
          workspacePath: "/tmp/project",
          archivedSubmission: null,
          documentId: "reply.md",
          isReadOnly: false,
        },
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(useDocumentStore.getState().replyContent).toBe("# session reply");
      expect(useAnnotationStore.getState().annotations[0]?.id).toBe("ann-1");
    });
  });

  it("keeps the newest session open when an earlier file read resolves later", async () => {
    const sessionA = createSession(
      "Session A",
      "/tmp/project-a/reply.md",
      [
        {
          id: "ann-a",
          documentId: "doc-a",
          quote: "A",
          comment: "First",
          kind: "comment",
          status: "open",
          createdAt: "2026-03-22T10:00:00.000Z",
        },
      ],
      [],
    );
    const sessionB = createSession(
      "Session B",
      "/tmp/project-b/reply.md",
      [
        {
          id: "ann-b",
          documentId: "doc-b",
          quote: "B",
          comment: "Second",
          kind: "comment",
          status: "open",
          createdAt: "2026-03-22T10:01:00.000Z",
        },
      ],
      [],
    );

    const snapshotA = deferred<Awaited<ReturnType<typeof reviewSnapshotModule.buildSessionReviewSnapshot>>>();
    const snapshotB = deferred<Awaited<ReturnType<typeof reviewSnapshotModule.buildSessionReviewSnapshot>>>();
    vi.spyOn(reviewSnapshotModule, "buildSessionReviewSnapshot").mockImplementation(
      (session) => {
        if (session.id === sessionA.id) return snapshotA.promise;
        if (session.id === sessionB.id) return snapshotB.promise;
        throw new Error(`Unexpected session: ${session.id}`);
      },
    );

    render(<SessionTree />);

    await waitFor(() => {
      expect(document.querySelector(`[data-session-id="${sessionA.id}"]`)).not.toBeNull();
      expect(document.querySelector(`[data-session-id="${sessionB.id}"]`)).not.toBeNull();
    });

    fireEvent.click(getSessionItem(sessionA.id));
    fireEvent.click(getSessionItem(sessionB.id));

    await waitFor(() => {
      expect(useSessionStore.getState().currentSessionId).toBe(sessionB.id);
    });

    await act(async () => {
      snapshotB.resolve({
        annotations: sessionB.annotations,
        document: {
          reply: "# session B",
          target: null,
          targetPath: null,
          reviewPath: "/tmp/project-b/reply.md",
          replyPath: "/tmp/project-b/reply.md",
          workspacePath: "/tmp/project-b",
          archivedSubmission: null,
          documentId: "reply.md",
          isReadOnly: false,
        },
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(useDocumentStore.getState().replyContent).toBe("# session B");
      expect(useDocumentStore.getState().reviewPath).toBe("/tmp/project-b/reply.md");
      expect(useAnnotationStore.getState().annotations[0]?.id).toBe("ann-b");
    });

    await act(async () => {
      snapshotA.resolve({
        annotations: sessionA.annotations,
        document: {
          reply: "# session A",
          target: null,
          targetPath: null,
          reviewPath: "/tmp/project-a/reply.md",
          replyPath: "/tmp/project-a/reply.md",
          workspacePath: "/tmp/project-a",
          archivedSubmission: null,
          documentId: "reply.md",
          isReadOnly: false,
        },
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(useSessionStore.getState().currentSessionId).toBe(sessionB.id);
      expect(useDocumentStore.getState().replyContent).toBe("# session B");
      expect(useDocumentStore.getState().reviewPath).toBe("/tmp/project-b/reply.md");
      expect(useDocumentStore.getState().workspacePath).toBe("/tmp/project-b");
      expect(useAnnotationStore.getState().annotations[0]?.id).toBe("ann-b");
    });
  });

  it("does not let a stale session restore overwrite a newer archive selection", async () => {
    const session = createSession(
      "Saved draft",
      "/tmp/project/reply.md",
      [
        {
          id: "ann-1",
          documentId: "doc-1",
          quote: "Body",
          comment: "Keep this editable",
          kind: "comment",
          status: "open",
          createdAt: "2026-03-22T10:00:00.000Z",
        },
      ],
      [],
    );

    const snapshot = deferred<Awaited<ReturnType<typeof reviewSnapshotModule.buildSessionReviewSnapshot>>>();
    vi.spyOn(reviewSnapshotModule, "buildSessionReviewSnapshot").mockReturnValue(snapshot.promise);

    render(<SessionTree />);

    await waitFor(() => {
      expect(document.querySelector(`[data-session-id="${session.id}"]`)).not.toBeNull();
    });

    fireEvent.click(getSessionItem(session.id));

    const openArchiveRequestId = reviewSnapshotModule.beginReviewRestoreRequest();
    reviewSnapshotModule.applyReviewSnapshot(
      reviewSnapshotModule.buildArchiveReviewSnapshot({
        summary: {
          id: "arch_2",
          workspaceKey: "ws_project",
          workspaceLabel: "project",
          workspacePath: "/tmp/project",
          archivedAt: "2026-03-22T11:00:00.000Z",
          agent: "codex",
          reviewPath: "/tmp/project/archive.md",
          replyPath: "/tmp/project/archive.md",
          targetPath: null,
          submittedChars: 22,
          itemCount: 1,
          preview: "archive preview",
          searchText: "archive preview",
        },
        replyContent: "# archived snapshot",
        annotations: [
          {
            id: "arch-ann",
            documentId: "arch_2",
            quote: "Archived",
            comment: "Archive wins",
            kind: "comment",
            status: "open",
            createdAt: "2026-03-22T11:00:00.000Z",
          },
        ],
        submission: {
          createdAt: "2026-03-22T11:00:00.000Z",
          method: "written",
          templateMode: "reply",
          userText: "archive input",
          finalOutput: "archive final",
        },
        targetBefore: null,
      }),
    );
    useHistoryStore.setState({
      currentArchiveRef: { workspaceKey: "ws_project", archiveId: "arch_2" },
      isLoading: false,
    });
    expect(reviewSnapshotModule.isCurrentReviewRestoreRequest(openArchiveRequestId)).toBe(true);

    await act(async () => {
      snapshot.resolve({
        annotations: session.annotations,
        resetSelection: true,
        resetReturnState: true,
        resetAnnotationUiState: true,
        document: {
          reply: "# session reply",
          target: null,
          targetPath: null,
          reviewPath: "/tmp/project/reply.md",
          replyPath: "/tmp/project/reply.md",
          workspacePath: "/tmp/project",
          archivedSubmission: null,
          documentId: "reply.md",
          isReadOnly: false,
        },
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(useDocumentStore.getState().replyContent).toBe("# archived snapshot");
      expect(useDocumentStore.getState().isReadOnly).toBe(true);
      expect(useAnnotationStore.getState().annotations[0]?.id).toBe("arch-ann");
      expect(useHistoryStore.getState().currentArchiveRef).toEqual({
        workspaceKey: "ws_project",
        archiveId: "arch_2",
      });
    });
  });

  it("shows the empty state when no saved sessions exist", () => {
    render(<SessionTree />);

    expect(screen.getByTestId("session-tree-empty")).toBeInTheDocument();
  });
});
