import {
  Maximize2,
  ZoomIn,
  ZoomOut,
  BookOpen,
  FolderOpen,
  Languages,
  Github,
} from "lucide-react";
import { useUIStore } from "@/stores";
import { DocumentSearch } from "@/features/documents";
import { ThemeSwitcher } from "@/features/documents/ThemeSwitcher";
import { useT } from "@/lib/useT";

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
  const { fontSize, adjustFontSize, toggleFullscreen, toggleLocale } = useUIStore();
  const t = useT();

  return (
    <div className="flex h-11 shrink-0 items-center justify-between border-b border-border-subtle/50 px-5" data-testid="topbar">
      {/* Left: brand */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="flex items-center gap-2 rounded-lg p-1.5 transition-colors hover:bg-surface-hover"
          title={sidebarOpen ? t("topbar.collapseSidebar") : t("topbar.expandSidebar")}
          data-testid="topbar-sidebar-toggle"
        >
          <BookOpen className="h-5 w-5 text-accent" />
        </button>
        <span className="text-sm font-bold tracking-tight text-text-strong">
          cliV
        </span>
        <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[0.7rem] font-medium text-accent/80">
          v0.2
        </span>
      </div>

      {/* Right: controls */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <DocumentSearch containerRef={scrollContainerRef} />

        {/* Open file */}
        <button
          onClick={onOpenFile}
          className="rounded-lg p-1.5 text-text-subtle hover:bg-surface-hover hover:text-text-primary transition-colors"
          title={t("topbar.openFile")}
          data-testid="topbar-open-file"
        >
          <FolderOpen className="h-4 w-4" />
        </button>

        {/* Font size */}
        <div className="flex items-center gap-0.5 rounded-lg border border-border-subtle/40 px-1" data-testid="topbar-font-controls">
          <button
            onClick={() => adjustFontSize(-1)}
            className="rounded p-1 text-text-subtle hover:text-text-primary transition-colors"
            title={t("topbar.zoomOut")}
            data-testid="topbar-zoom-out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-[26px] text-center font-mono text-xs text-text-muted" data-testid="topbar-font-size">
            {fontSize}
          </span>
          <button
            onClick={() => adjustFontSize(1)}
            className="rounded p-1 text-text-subtle hover:text-text-primary transition-colors"
            title={t("topbar.zoomIn")}
            data-testid="topbar-zoom-in"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Divider */}
        <div className="h-4 w-px bg-border-subtle/40" />

        {/* Theme pills */}
        <ThemeSwitcher />

        {/* Divider */}
        <div className="h-4 w-px bg-border-subtle/40" />

        {/* Language toggle */}
        <button
          onClick={toggleLocale}
          className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-xs font-medium text-text-subtle hover:bg-surface-hover hover:text-text-primary transition-colors"
          title={t("lang.switch")}
          data-testid="topbar-locale-toggle"
        >
          <Languages className="h-3.5 w-3.5" />
          <span>{t("lang.switch")}</span>
        </button>

        {/* Divider */}
        <div className="h-4 w-px bg-border-subtle/40" />

        {/* GitHub */}
        <a
          href="https://github.com/BobDLA/cliv"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-border-strong/70 bg-surface-panel px-2 py-1 text-xs font-medium text-text-primary transition-colors hover:border-accent/30 hover:bg-surface-hover hover:text-text-strong"
          title="View on GitHub"
          data-testid="topbar-github-link"
        >
          <Github className="h-3.5 w-3.5 text-accent/90" />
          <span>GitHub</span>
        </a>

        {/* Divider */}
        <div className="h-4 w-px bg-border-subtle/40" />

        {/* Fullscreen */}
        <button
          onClick={toggleFullscreen}
          className="rounded-lg p-1.5 text-text-subtle hover:bg-surface-hover hover:text-text-primary transition-colors"
          title={t("topbar.fullscreen")}
          data-testid="topbar-fullscreen-toggle"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
