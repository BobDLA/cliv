import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LeftSidebar } from "@/app/components/LeftSidebar";
import { useDocumentStore, useUIStore } from "@/stores";

vi.mock("@/features/documents", () => ({
  DocumentOutline: () => <div data-testid="document-outline-stub">Outline</div>,
}));

vi.mock("@/features/history", () => ({
  HistoryTree: () => <div data-testid="history-tree-stub">History</div>,
}));

vi.mock("@/features/sessions", () => ({
  SessionTree: () => <div data-testid="session-tree-stub">Sessions</div>,
}));

describe("LeftSidebar", () => {
  beforeEach(() => {
    useUIStore.setState({
      sidebarTab: "history",
      locale: "en",
    });
    useDocumentStore.setState({
      isReadOnly: false,
      error: null,
    });
  });

  it("keeps archived history as the default view and still exposes saved sessions", () => {
    render(
      <LeftSidebar
        width={240}
        headings={[]}
        onDragStart={() => {}}
      />,
    );

    expect(screen.getByTestId("history-tree-stub")).toBeInTheDocument();
    expect(screen.queryByTestId("session-tree-stub")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("history-view-sessions"));

    expect(screen.getByTestId("session-tree-stub")).toBeInTheDocument();
    expect(screen.queryByTestId("history-tree-stub")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("history-view-archives"));

    expect(screen.getByTestId("history-tree-stub")).toBeInTheDocument();
  });

  it("still switches back to the outline tab", () => {
    render(
      <LeftSidebar
        width={240}
        headings={[]}
        onDragStart={() => {}}
      />,
    );

    fireEvent.click(screen.getByTestId("sidebar-tab-outline"));

    expect(screen.getByTestId("document-outline-stub")).toBeInTheDocument();
    expect(useUIStore.getState().sidebarTab).toBe("outline");
  });
});
