import { useState } from "react";
import { useDocumentStore, useUIStore } from "@/stores";
import { DocumentOutline, type HeadingInfo } from "@/features/documents";
import { HistoryTree } from "@/features/history";
import { SessionTree } from "@/features/sessions";
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
  const [historyView, setHistoryView] = useState<"archives" | "sessions">("archives");
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
  const historyViewButtonClass = (view: "archives" | "sessions") =>
    [
      "flex-1 rounded-md px-2.5 py-1.5 text-xs font-semibold tracking-wide transition-colors",
      historyView === view
        ? "bg-accent text-white"
        : "text-text-subtle hover:text-text-primary",
    ].join(" ");

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
            sidebarTab === "outline" ? "flex-1 overflow-y-auto" : "flex-1 min-h-0"
          }
        >
          {sidebarTab === "outline" ? (
            <DocumentOutline headings={headings} />
          ) : (
            <div className="flex h-full min-h-0 flex-col">
              <div className="border-b border-border-subtle/50 px-2 py-2">
                <div className="flex rounded-lg bg-surface-panel/80 p-1">
                  <button
                    type="button"
                    onClick={() => setHistoryView("archives")}
                    className={historyViewButtonClass("archives")}
                    data-testid="history-view-archives"
                  >
                    {t("history.archivesTab")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryView("sessions")}
                    className={historyViewButtonClass("sessions")}
                    data-testid="history-view-sessions"
                  >
                    {t("history.sessionsTab")}
                  </button>
                </div>
              </div>
              <div className="min-h-0 flex-1">
                {historyView === "archives" ? (
                  <HistoryTree />
                ) : (
                  <div className="h-full overflow-y-auto">
                    <SessionTree />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        {sidebarTab === "history" && isReadOnly ? (
          <div className="border-t border-border-subtle/50 px-3 py-2 text-[0.75rem] text-text-subtle">
            {t("history.readOnlyBadge")}
          </div>
        ) : null}
      </aside>
      <ResizeHandle onDragStart={onDragStart} />
    </>
  );
}
