import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { App } from "@/app/App";

describe("App", () => {
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
