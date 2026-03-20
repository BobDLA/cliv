import { useState } from "react";
import { Save } from "lucide-react";
import { useSessionStore, useAnnotationStore } from "@/stores";
import { DocumentOutline, type HeadingInfo } from "@/features/documents";
import { SessionTree } from "@/features/sessions";
import { ResizeHandle } from "./ResizeHandle";
import { useT } from "@/lib/useT";

interface LeftSidebarProps {
  width: number;
  headings: HeadingInfo[];
  composePath: string | null;
  onDragStart: (e: React.MouseEvent) => void;
}

export function LeftSidebar({
  width,
  headings,
  composePath,
  onDragStart,
}: LeftSidebarProps) {
  const [sidebarTab, setSidebarTab] = useState<"outline" | "history">(
    "outline",
  );
  const { createNewSession, autoSave, currentSessionId } = useSessionStore();
  const annotations = useAnnotationStore((s) => s.annotations);
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
            <SessionTree />
          )}
        </div>
        {/* Save session button */}
        {sidebarTab === "history" && annotations.length > 0 && (
          <div className="border-t border-border-subtle/50 p-2" data-testid="sidebar-history-actions">
            <button
              onClick={() => {
                if (currentSessionId) {
                  autoSave();
                } else {
                  const name = `Session ${new Date().toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`;
                  createNewSession(name, composePath);
                }
              }}
              className="w-full flex items-center justify-center gap-2 rounded-md bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/20 transition-colors"
              data-testid="sidebar-save-session"
            >
              <Save className="h-3.5 w-3.5" />
              {currentSessionId ? t("sidebar.save") : t("sidebar.saveSession")}
            </button>
          </div>
        )}
      </aside>
      {/* Sidebar resize handle */}
      <ResizeHandle onDragStart={onDragStart} />
    </>
  );
}
