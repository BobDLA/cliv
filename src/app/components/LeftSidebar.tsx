import { useDocumentStore, useUIStore } from "@/stores";
import { DocumentOutline, type HeadingInfo } from "@/features/documents";
import { HistoryTree } from "@/features/history";
import { ResizeHandle } from "./ResizeHandle";
import { useT } from "@/lib/useT";

interface LeftSidebarProps {
  width: number;
  headings: HeadingInfo[];
  onDragStart: (e: React.MouseEvent) => void;
}

export function LeftSidebar({
  width,
  headings,
  onDragStart,
}: LeftSidebarProps) {
  const sidebarTab = useUIStore((state) => state.sidebarTab);
  const setSidebarTab = useUIStore((state) => state.setSidebarTab);
  const isReadOnly = useDocumentStore((state) => state.isReadOnly);
  const t = useT();

  const outlineTabClass = [
    "flex-1 px-3 py-2.5 text-sm font-semibold tracking-wide transition-colors",
    sidebarTab === "outline"
      ? "border-b-2 border-accent text-accent"
      : "text-text-subtle hover:text-text-primary",
  ].join(" ");
  const historyTabClass = [
    "flex-1 px-3 py-2.5 text-sm font-semibold tracking-wide transition-colors",
    sidebarTab === "history"
      ? "border-b-2 border-accent text-accent"
      : "text-text-subtle hover:text-text-primary",
  ].join(" ");

  return (
    <div
      className="grid shrink-0 bg-surface-sidebar"
      style={{
        gridTemplateColumns: `${width}px 6px`,
        gridTemplateRows: "auto minmax(0, 1fr)",
      }}
    >
      <aside
        className="row-span-2 flex min-h-0 min-w-0 flex-col bg-surface-sidebar"
        data-testid="left-sidebar"
      >
        <div className="flex items-center border-b border-border-subtle/50">
          <button
            onClick={() => setSidebarTab("outline")}
            className={outlineTabClass}
            data-testid="sidebar-tab-outline"
          >
            {t("sidebar.outline")}
          </button>
          <button
            onClick={() => setSidebarTab("history")}
            className={historyTabClass}
            data-testid="sidebar-tab-history"
          >
            {t("sidebar.history")}
          </button>
        </div>
        <div
          className={
            sidebarTab === "outline"
              ? "flex-1 min-h-0 overflow-y-auto"
              : "flex-1 min-h-0"
          }
        >
          {sidebarTab === "outline" ? (
            <DocumentOutline headings={headings} />
          ) : (
            <HistoryTree />
          )}
        </div>
        {sidebarTab === "history" && isReadOnly ? (
          <div className="border-t border-border-subtle/50 px-3 py-2 text-[0.75rem] text-text-subtle">
            {t("history.readOnlyBadge")}
          </div>
        ) : null}
      </aside>
      <ResizeHandle
        onDragStart={onDragStart}
        testId="left-sidebar-resize-handle"
        style={{ gridColumn: 2, gridRow: 2, alignSelf: "stretch" }}
      />
    </div>
  );
}
