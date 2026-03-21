import { useState } from "react";
import { useDocumentStore } from "@/stores";
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
  const [sidebarTab, setSidebarTab] = useState<"outline" | "history">(
    "outline",
  );
  const isReadOnly = useDocumentStore((s) => s.isReadOnly);
  const t = useT();

  return (
    <>
      <aside
        style={{ width: `${width}px` }}
        className="flex shrink-0 flex-col bg-surface-sidebar"
        data-testid="left-sidebar"
      >
        <div className="flex items-center border-b border-border-subtle/50">
          <button
            onClick={() => setSidebarTab("outline")}
            className={`flex-1 px-3 py-2.5 text-sm font-semibold tracking-wide transition-colors ${
              sidebarTab === "outline"
                ? "text-accent border-b-2 border-accent"
                : "text-text-subtle hover:text-text-primary"
            }`}
            data-testid="sidebar-tab-outline"
          >
            {t("sidebar.outline")}
          </button>
          <button
            onClick={() => setSidebarTab("history")}
            className={`flex-1 px-3 py-2.5 text-sm font-semibold tracking-wide transition-colors ${
              sidebarTab === "history"
                ? "text-accent border-b-2 border-accent"
                : "text-text-subtle hover:text-text-primary"
            }`}
            data-testid="sidebar-tab-history"
          >
            {t("sidebar.history")}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
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
      {/* Sidebar resize handle */}
      <ResizeHandle onDragStart={onDragStart} />
    </>
  );
}
