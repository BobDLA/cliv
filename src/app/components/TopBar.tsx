import { useEffect, useRef, useState } from "react";
import { BookOpen, FolderOpen, Github, SlidersHorizontal } from "lucide-react";
import { DocumentSearch } from "@/features/documents";
import { useT } from "@/lib/useT";
import { PersonalizationPanel } from "./PersonalizationPanel";

interface TopBarProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onOpenFile: () => void;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

export function TopBar({
  sidebarOpen,
  onToggleSidebar,
  onOpenFile,
  scrollContainerRef,
}: TopBarProps) {
  const t = useT();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!settingsOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (settingsRef.current == null) return;
      if (settingsRef.current.contains(event.target as Node)) return;
      setSettingsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSettingsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [settingsOpen]);

  return (
    <div
      className="flex h-11 shrink-0 items-center justify-between border-b border-border-subtle/50 px-5"
      data-testid="topbar"
    >
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="flex items-center gap-2 rounded-lg p-1.5 transition-colors hover:bg-surface-hover"
          title={sidebarOpen ? t("topbar.collapseSidebar") : t("topbar.expandSidebar")}
          data-testid="topbar-sidebar-toggle"
        >
          <BookOpen className="h-5 w-5 text-accent" />
        </button>
        <span className="text-sm font-bold tracking-tight text-text-strong">cliV</span>
        <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[0.7rem] font-medium text-accent/80">
          v0.2
        </span>
      </div>

      <div className="flex items-center gap-3">
        <DocumentSearch containerRef={scrollContainerRef} />

        <button
          onClick={onOpenFile}
          className="rounded-lg p-1.5 text-text-subtle transition-colors hover:bg-surface-hover hover:text-text-primary"
          title={t("topbar.openFile")}
          data-testid="topbar-open-file"
        >
          <FolderOpen className="h-4 w-4" />
        </button>

        <div className="relative" ref={settingsRef}>
          <button
            type="button"
            onClick={() => setSettingsOpen((open) => !open)}
            className="rounded-lg p-1.5 text-text-subtle transition-colors hover:bg-surface-hover hover:text-text-primary"
            title={t("settings.open")}
            aria-expanded={settingsOpen}
            aria-haspopup="dialog"
            data-testid="topbar-settings-toggle"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
          {settingsOpen ? <PersonalizationPanel /> : null}
        </div>

        <div className="h-4 w-px bg-border-subtle/40" />

        <a
          href="https://github.com/BobDLA/cliv"
          target="_blank"
          rel="noopener noreferrer"
          className="mr-1 inline-flex items-center gap-1.5 rounded-md border border-border-strong/70 bg-surface-panel px-2 py-1 text-xs font-medium text-text-primary transition-colors hover:border-accent/30 hover:bg-surface-hover hover:text-text-strong"
          title="View on GitHub"
          data-testid="topbar-github-link"
        >
          <Github className="h-3.5 w-3.5 text-accent/90" />
          <span>GitHub</span>
        </a>
      </div>
    </div>
  );
}
