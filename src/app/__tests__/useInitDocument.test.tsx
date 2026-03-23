import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_CONTENT_EN, DEMO_CONTENT_ZH } from "@/app/demoContent";
import { useInitDocument } from "@/app/hooks/useInitDocument";
import {
  useAnnotationStore,
  useConfigStore,
  useDocumentStore,
  useUIStore,
} from "@/stores";

function InitDocumentHarness() {
  useInitDocument();
  return null;
}

describe("useInitDocument", () => {
  beforeEach(() => {
    localStorage.clear();
    Reflect.deleteProperty(window, "__TAURI_INTERNALS__");

    useAnnotationStore.setState({
      annotations: [
        {
          id: "stale-note",
          documentId: "previous-doc",
          quote: "stale quote",
          comment: "stale comment",
          kind: "comment",
          status: "open",
          createdAt: "2026-03-23T00:00:00.000Z",
        },
      ],
      activeAnnotationId: "stale-note",
      hoveredAnnotationId: "stale-note",
      editingAnnotationId: "stale-note",
    });
    useConfigStore.setState({ appConfig: null, promptConfig: null });
    useDocumentStore.setState({
      replyContent: null,
      targetContent: null,
      targetPath: null,
      reviewPath: null,
      replyPath: null,
      workspacePath: null,
      archivedSubmission: null,
      documentId: "default",
      isReadOnly: false,
      isLoading: false,
      error: null,
    });
    useUIStore.setState({ locale: "en" });
  });

  it("loads the docs-backed English demo content in browser mode", async () => {
    render(<InitDocumentHarness />);

    await waitFor(() => {
      expect(useDocumentStore.getState().replyContent).toBe(DEMO_CONTENT_EN);
    });

    expect(useDocumentStore.getState().documentId).toBe("demo");
    expect(useDocumentStore.getState().workspacePath).toBeNull();
    expect(useAnnotationStore.getState().annotations).toHaveLength(0);
  });

  it("reloads the docs-backed demo content when the locale changes", async () => {
    render(<InitDocumentHarness />);

    await waitFor(() => {
      expect(useDocumentStore.getState().replyContent).toBe(DEMO_CONTENT_EN);
    });

    useAnnotationStore.setState({
      annotations: [
        {
          id: "switch-note",
          documentId: "demo",
          quote: "switch quote",
          comment: "switch comment",
          kind: "question",
          status: "open",
          createdAt: "2026-03-23T00:00:00.000Z",
        },
      ],
      activeAnnotationId: "switch-note",
      hoveredAnnotationId: "switch-note",
      editingAnnotationId: "switch-note",
    });

    act(() => {
      useUIStore.setState({ locale: "zh" });
    });

    await waitFor(() => {
      expect(useDocumentStore.getState().replyContent).toBe(DEMO_CONTENT_ZH);
    });

    expect(useAnnotationStore.getState().annotations).toHaveLength(0);
    expect(useAnnotationStore.getState().activeAnnotationId).toBeNull();
    expect(useAnnotationStore.getState().hoveredAnnotationId).toBeNull();
    expect(useAnnotationStore.getState().editingAnnotationId).toBeNull();
  });
});
