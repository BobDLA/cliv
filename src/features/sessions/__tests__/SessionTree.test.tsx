import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { SessionTree } from "@/features/sessions";
import {
  useAnnotationStore,
  useDocumentStore,
  useSessionStore,
  useUIStore,
} from "@/stores";
import { createSession } from "@/services/sessionService";

describe("SessionTree", () => {
  beforeEach(() => {
    localStorage.clear();

    useSessionStore.setState({
      currentSessionId: null,
      sessions: [],
    });
    useAnnotationStore.setState({
      annotations: [],
      activeAnnotationId: null,
      hoveredAnnotationId: null,
      editingAnnotationId: null,
    });
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

  it("restores an editable saved session without forcing archive replay state", async () => {
    createSession(
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

    const sessionItem = await screen.findByTestId("session-item");
    fireEvent.click(sessionItem);

    await waitFor(() => {
      expect(useSessionStore.getState().currentSessionId).toMatch(/^sess_/);
    });

    expect(useAnnotationStore.getState().annotations).toHaveLength(1);
    expect(useDocumentStore.getState().reviewPath).toBe("/tmp/project/reply.md");
    expect(useDocumentStore.getState().workspacePath).toBe("/tmp/project");
    expect(useDocumentStore.getState().archivedSubmission).toBeNull();
    expect(useDocumentStore.getState().isReadOnly).toBe(false);
    expect(useDocumentStore.getState().replyContent).toBe("# live document");
  });

  it("shows the empty state when no saved sessions exist", () => {
    render(<SessionTree />);

    expect(screen.getByTestId("session-tree-empty")).toBeInTheDocument();
  });
});
