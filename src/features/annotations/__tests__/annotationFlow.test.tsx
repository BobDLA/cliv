import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useRef } from "react";
import { AnnotationPopup } from "@/features/annotations/AnnotationPopup";
import { AnnotationOverlay } from "@/features/annotations/AnnotationOverlay";
import { SelectionCatcher } from "@/features/annotations/SelectionCatcher";
import { maybeCreateAnnotationFromDraft } from "@/features/annotations/createAnnotation";
import {
  useAnnotationStore,
  useDocumentStore,
  useSelectionStore,
  useUIStore,
} from "@/stores";
import type { SelectionInfo } from "@/types";

function TestHarness() {
  const viewerRef = useRef<HTMLDivElement>(null);

  return (
    <div>
      <div ref={viewerRef} data-viewer-root>
        <p data-testid="viewer-text">Alpha beta gamma delta</p>
      </div>
      <SelectionCatcher containerRef={viewerRef} />
      <AnnotationOverlay containerRef={viewerRef} />
      <AnnotationPopup />
    </div>
  );
}

function selectSubstring(node: Text, start: number, end: number) {
  act(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    const selection = window.getSelection();
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, end);
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
    document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });
}

async function flushFrame() {
  await act(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });
}

async function waitForTimeout(ms: number) {
  await act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, ms));
  });
}

const highlightSet = vi.fn();
const highlightDelete = vi.fn();

beforeAll(() => {
  Object.defineProperty(Range.prototype, "getBoundingClientRect", {
    configurable: true,
    value: () =>
      ({
        x: 20,
        y: 10,
        top: 10,
        left: 20,
        bottom: 30,
        right: 120,
        width: 100,
        height: 20,
        toJSON: () => ({}),
      }) as DOMRect,
  });

  class HighlightMock {
    ranges: Range[];

    constructor(...ranges: Range[]) {
      this.ranges = ranges;
    }
  }

  Object.defineProperty(window, "Highlight", {
    configurable: true,
    value: HighlightMock,
  });

  Object.defineProperty(globalThis, "CSS", {
    configurable: true,
    value: {
      highlights: {
        set: highlightSet,
        delete: highlightDelete,
      },
    },
  });
});

describe("annotation selection flow", () => {
  beforeEach(() => {
    highlightSet.mockClear();
    highlightDelete.mockClear();
    useSelectionStore.getState().reset();
    useAnnotationStore.getState().clearAnnotations();
    useDocumentStore.getState().setDocument({
      reply: null,
      target: null,
      targetPath: null,
      replyPath: null,
      documentId: "test-doc",
    });
    useDocumentStore.getState().setLoading(false);
    useDocumentStore.getState().setError(null);
    useUIStore.setState({
      theme: "light",
      fontSize: 18,
      locale: "en",
    });
    window.getSelection()?.removeAllRanges();
  });

  it("opens the popup and focuses the textarea immediately after selection", async () => {
    render(<TestHarness />);

    const textNode = screen.getByTestId("viewer-text").firstChild as Text;
    selectSubstring(textNode, 0, 5);

    const textarea = await screen.findByTestId("annotation-popup-textarea");
    await waitFor(() => expect(textarea).toHaveFocus());

    expect(useSelectionStore.getState().showPopup).toBe(true);
    expect(useSelectionStore.getState().selection?.quote).toBe("Alpha");
    expect(highlightSet).toHaveBeenCalledWith(
      "annotation-creating",
      expect.objectContaining({
        ranges: expect.any(Array),
      }),
    );
  });

  it("builds annotations from non-empty drafts and ignores empty drafts", () => {
    const selection: SelectionInfo = {
      quote: "Alpha",
      range: {
        startOffset: 0,
        endOffset: 5,
        contextSnippet: "Alpha",
      },
      rect: {
        top: 10,
        left: 20,
        bottom: 30,
        width: 100,
      },
    };

    const annotation = maybeCreateAnnotationFromDraft(
      selection,
      "  first note  ",
      "comment",
    );

    expect(annotation).toMatchObject({
      documentId: "test-doc",
      quote: "Alpha",
      comment: "first note",
      kind: "comment",
    });
    expect(maybeCreateAnnotationFromDraft(selection, "   ", "comment")).toBeNull();
    expect(maybeCreateAnnotationFromDraft(null, "first note", "comment")).toBeNull();
  });

  it("keeps the active draft and original selection during unrelated reselection", async () => {
    render(<TestHarness />);

    const textNode = screen.getByTestId("viewer-text").firstChild as Text;
    selectSubstring(textNode, 0, 5);

    const textarea = await screen.findByTestId("annotation-popup-textarea");
    fireEvent.change(textarea, { target: { value: "First note" } });
    await flushFrame();

    selectSubstring(textNode, 6, 10);
    await flushFrame();

    expect(useAnnotationStore.getState().annotations).toHaveLength(0);
    expect(useSelectionStore.getState().selection?.quote).toBe("Alpha");
    expect(useSelectionStore.getState().draftComment).toBe("First note");
    expect(screen.getByTestId("annotation-popup")).toBeInTheDocument();
  });

  it("still submits the original selection after unrelated reselection", async () => {
    render(<TestHarness />);

    const textNode = screen.getByTestId("viewer-text").firstChild as Text;
    selectSubstring(textNode, 0, 5);

    const textarea = await screen.findByTestId("annotation-popup-textarea");
    fireEvent.change(textarea, { target: { value: "First note" } });
    await flushFrame();

    selectSubstring(textNode, 6, 10);
    await flushFrame();

    fireEvent.click(screen.getByTestId("annotation-popup-submit"));

    await waitFor(() => {
      expect(useAnnotationStore.getState().annotations).toHaveLength(1);
    });

    const [annotation] = useAnnotationStore.getState().annotations;
    expect(annotation).toMatchObject({
      documentId: "test-doc",
      quote: "Alpha",
      comment: "First note",
      kind: "comment",
    });
  });

  it("keeps the original selection active during unrelated reselection with an empty draft", async () => {
    render(<TestHarness />);

    const textNode = screen.getByTestId("viewer-text").firstChild as Text;
    selectSubstring(textNode, 0, 5);
    await screen.findByTestId("annotation-popup-textarea");

    selectSubstring(textNode, 6, 10);
    await flushFrame();

    expect(useAnnotationStore.getState().annotations).toHaveLength(0);
    expect(useSelectionStore.getState().selection?.quote).toBe("Alpha");
    expect(useSelectionStore.getState().draftComment).toBe("");
    expect(screen.getByTestId("annotation-popup")).toBeInTheDocument();
  });

  it("does not close the create popup on outside click", async () => {
    render(
      <div>
        <TestHarness />
        <button data-testid="outside-target" type="button">
          outside
        </button>
      </div>,
    );

    const textNode = screen.getByTestId("viewer-text").firstChild as Text;
    selectSubstring(textNode, 0, 5);

    const textarea = await screen.findByTestId("annotation-popup-textarea");
    fireEvent.change(textarea, { target: { value: "Draft stays" } });
    await waitForTimeout(200);

    fireEvent.mouseDown(screen.getByTestId("outside-target"));
    await flushFrame();

    expect(screen.getByTestId("annotation-popup")).toBeInTheDocument();
    expect(useSelectionStore.getState().showPopup).toBe(true);
    expect(useSelectionStore.getState().selection?.quote).toBe("Alpha");
    expect(useSelectionStore.getState().draftComment).toBe("Draft stays");
  });

  it("keeps the create popup open when selectionchange later collapses", async () => {
    render(<TestHarness />);

    const textNode = screen.getByTestId("viewer-text").firstChild as Text;
    selectSubstring(textNode, 0, 5);

    const textarea = await screen.findByTestId("annotation-popup-textarea");
    await waitFor(() => expect(textarea).toHaveFocus());

    act(() => {
      window.getSelection()?.removeAllRanges();
      document.dispatchEvent(new Event("selectionchange"));
    });
    await flushFrame();

    expect(screen.getByTestId("annotation-popup")).toBeInTheDocument();
    expect(useSelectionStore.getState().showPopup).toBe(true);
    expect(useSelectionStore.getState().selection?.quote).toBe("Alpha");
    expect(highlightSet).toHaveBeenCalledWith(
      "annotation-creating",
      expect.objectContaining({
        ranges: expect.any(Array),
      }),
    );
  });

  it("clears the temporary create highlight after submit", async () => {
    render(<TestHarness />);

    const textNode = screen.getByTestId("viewer-text").firstChild as Text;
    selectSubstring(textNode, 0, 5);

    const textarea = await screen.findByTestId("annotation-popup-textarea");
    fireEvent.change(textarea, { target: { value: "First note" } });
    await flushFrame();

    highlightDelete.mockClear();
    fireEvent.click(screen.getByTestId("annotation-popup-submit"));

    await waitFor(() => {
      expect(useAnnotationStore.getState().annotations).toHaveLength(1);
    });
    await flushFrame();

    expect(highlightDelete).toHaveBeenCalledWith("annotation-creating");
  });

  it("discards the draft when closing the popup with Escape", async () => {
    render(<TestHarness />);

    const textNode = screen.getByTestId("viewer-text").firstChild as Text;
    selectSubstring(textNode, 0, 5);

    const textarea = await screen.findByTestId("annotation-popup-textarea");
    fireEvent.change(textarea, { target: { value: "Draft to discard" } });
    fireEvent.keyDown(textarea, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByTestId("annotation-popup")).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(useSelectionStore.getState().selection).toBeNull();
    });
    await flushFrame();

    expect(useAnnotationStore.getState().annotations).toHaveLength(0);
    expect(useSelectionStore.getState().draftComment).toBe("");
    expect(highlightDelete).toHaveBeenCalledWith("annotation-creating");
  });
});
