import {
  Maximize2,
  ZoomIn,
  ZoomOut,
  BookOpen,
  FolderOpen,
  Languages,
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
    <div className="flex h-11 shrink-0 items-center justify-between border-b border-border-subtle/50 px-4">
      {/* Left: brand */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="flex items-center gap-2 rounded-lg p-1.5 transition-colors hover:bg-surface-hover"
          title={sidebarOpen ? t("topbar.collapseSidebar") : t("topbar.expandSidebar")}
        >
          <BookOpen className="h-5 w-5 text-accent" />
        </button>
        <span className="text-sm font-bold tracking-tight text-text-strong">
          Open Reviewer
        </span>
        <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent/80">
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
        >
          <FolderOpen className="h-4 w-4" />
        </button>

        {/* Font size */}
        <div className="flex items-center gap-0.5 rounded-lg border border-border-subtle/40 px-1">
          <button
            onClick={() => adjustFontSize(-1)}
            className="rounded p-1 text-text-subtle hover:text-text-primary transition-colors"
            title={t("topbar.zoomOut")}
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-[26px] text-center font-mono text-xs text-text-muted">
            {fontSize}
          </span>
          <button
            onClick={() => adjustFontSize(1)}
            className="rounded p-1 text-text-subtle hover:text-text-primary transition-colors"
            title={t("topbar.zoomIn")}
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
        >
          <Languages className="h-3.5 w-3.5" />
          <span>{t("lang.switch")}</span>
        </button>

        {/* Divider */}
        <div className="h-4 w-px bg-border-subtle/40" />

        {/* Fullscreen */}
        <button
          onClick={toggleFullscreen}
          className="rounded-lg p-1.5 text-text-subtle hover:bg-surface-hover hover:text-text-primary transition-colors"
          title={t("topbar.fullscreen")}
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
