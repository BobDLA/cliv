import { useRef } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DocumentSearch } from "@/features/documents/DocumentSearch";
import { DEFAULT_SHORTCUTS } from "@/lib/shortcuts";
import { useUIStore } from "@/stores";

function Harness() {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div>
      <div ref={containerRef}>Alpha beta gamma</div>
      <DocumentSearch containerRef={containerRef} />
    </div>
  );
}

describe("DocumentSearch", () => {
  beforeEach(() => {
    localStorage.clear();
    useUIStore.getState().resetPreferences();
    useUIStore.setState({
      shortcuts: {
        ...DEFAULT_SHORTCUTS,
        search: "Mod+J",
      },
      locale: "en",
    });
  });

  it("opens with a customized search shortcut", () => {
    render(<Harness />);

    fireEvent.keyDown(document, { key: "j", ctrlKey: true });

    expect(screen.getByTestId("document-search")).toBeInTheDocument();
  });
});
