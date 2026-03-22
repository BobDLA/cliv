import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { App } from "@/app/App";
import { useDocumentStore, useUIStore } from "@/stores";

vi.mock("@/app/hooks/useInitDocument", () => ({
  useInitDocument: () => {},
  openFileFromTauri: () => () => Promise.resolve(),
}));

describe("App", () => {
  beforeEach(() => {
    localStorage.clear();
    useDocumentStore.setState({
      replyContent: "# cliV\n\nTest document",
      targetContent: null,
      targetPath: null,
      reviewPath: "demo.md",
      replyPath: "demo.md",
      workspacePath: null,
      archivedSubmission: null,
      documentId: "test-doc",
      isReadOnly: false,
      isLoading: false,
      error: null,
    });

    useUIStore.setState({
      theme: "light",
      fontSize: 18,
      locale: "en",
      sidebarOpen: true,
      sidebarTab: "outline",
      sidebarWidth: 224,
      marginWidth: 256,
      contentWidth: "standard",
      pagePadding: "comfortable",
      readingDensity: "comfortable",
      highlightStrength: "balanced",
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

  it("shows archived free-edit content while viewing read-only history", () => {
    useDocumentStore.setState({
      replyContent: "# Archived reply\n\nHistory replay",
      targetContent: null,
      targetPath: null,
      reviewPath: "archived.md",
      replyPath: "archived.md",
      workspacePath: "/tmp/workspace",
      archivedSubmission: {
        createdAt: "2026-03-22T10:01:00.000Z",
        method: "written",
        templateMode: "reply",
        userText: "Archived custom input",
        finalOutput: "Archived custom input",
      },
      documentId: "archived-doc",
      isReadOnly: true,
      isLoading: false,
      error: null,
    });

    render(<App />);

    const textarea = screen.getByTestId("return-free-edit");
    expect(textarea).toHaveValue("Archived custom input");
    expect(textarea).toHaveAttribute("readonly");
    expect(screen.getByTestId("topbar-readonly-badge")).toHaveTextContent(
      "History Replay",
    );
    expect(screen.getByTestId("history-readonly-banner")).toHaveTextContent(
      "You are viewing an archived snapshot for review only.",
    );
    expect(screen.getByText("Viewing read-only archived review")).toBeInTheDocument();
  });

  it("opens the personalization panel from the top bar", () => {
    render(<App />);

    expect(screen.queryByTestId("personalization-panel")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("topbar-settings-toggle"));

    expect(screen.getByTestId("personalization-panel")).toBeInTheDocument();
    expect(screen.getByTestId("theme-switcher")).toBeInTheDocument();
    expect(screen.getByTestId("settings-font-controls")).toHaveTextContent("18px");
  });
});
