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

  it("shows archived history directly without exposing saved sessions", () => {
    render(
      <LeftSidebar
        width={240}
        headings={[]}
        onDragStart={() => {}}
      />,
    );

    expect(screen.getByTestId("history-tree-stub")).toBeInTheDocument();
    expect(screen.queryByTestId("history-view-archives")).not.toBeInTheDocument();
    expect(screen.queryByTestId("history-view-sessions")).not.toBeInTheDocument();
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

  it("keeps the resize handle below the tab strip", () => {
    render(
      <LeftSidebar
        width={240}
        headings={[]}
        onDragStart={() => {}}
      />,
    );

    expect(screen.getByTestId("left-sidebar-resize-handle")).toHaveStyle({
      gridRow: "2",
    });
  });
});
