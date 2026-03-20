import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { App } from "@/app/App";
import { useDocumentStore, useUIStore } from "@/stores";

vi.mock("@/app/hooks/useInitDocument", () => ({
  useInitDocument: () => {},
  openFileFromTauri: () => () => Promise.resolve(),
}));

describe("App", () => {
  beforeEach(() => {
    useDocumentStore.setState({
      replyContent: "# cliV v0.2\n\nTest document",
      composeContent: null,
      composePath: null,
      replyPath: "demo.md",
      documentId: "test-doc",
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

  it("should render the app shell", () => {
    render(<App />);
    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
  });

  it("should display the title", () => {
    render(<App />);
    expect(screen.getByText("cliV")).toBeInTheDocument();
  });

  it("should show the version message", () => {
    render(<App />);
    expect(screen.getByText("cliV v0.2")).toBeInTheDocument();
  });
});
