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
      replyContent: "# cliV\n\nTest document",
      targetContent: null,
      targetPath: null,
      reviewPath: "demo.md",
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
    expect(screen.getAllByText("cliV").length).toBeGreaterThan(0);
  });

  it("should show the version message", () => {
    render(<App />);
    expect(screen.getByText("Test document")).toBeInTheDocument();
  });

  it("renders the GitHub link in the top bar", () => {
    render(<App />);
    const githubLink = screen.getByTestId("topbar-github-link");
    expect(githubLink).toHaveTextContent("GitHub");
    expect(githubLink).toHaveAttribute("href", "https://github.com/BobDLA/cliv");
  });
});
