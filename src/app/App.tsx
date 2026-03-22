import { useState, useCallback, useRef } from "react";
import { useUIStore, useDocumentStore } from "@/stores";
import { type HeadingInfo } from "@/features/documents";
import { AlertCircle, Loader2 } from "lucide-react";
import { useT } from "@/lib/useT";
import { getPathInfo, resolveWorkspacePath } from "@/lib/pathUtils";

import { useInitDocument, openFileFromTauri } from "./hooks/useInitDocument";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useColumnResize } from "./hooks/useColumnResize";
import { TopBar } from "./components/TopBar";
import { LeftSidebar } from "./components/LeftSidebar";
import { DocumentArea } from "./components/DocumentArea";
import { PersonalizationPanel } from "./components/PersonalizationPanel";

/**
 * App shell — thin orchestrator.
 * All logic lives in extracted hooks; all UI in extracted components.
 */
export function App() {
  const sidebarOpen = useUIStore((state) => state.sidebarOpen);
  const toggleSidebarOpen = useUIStore((state) => state.toggleSidebarOpen);
  const { replyContent, isLoading, error, setDocument, setError } =
    useDocumentStore();
  const t = useT();

  const [headings, setHeadings] = useState<HeadingInfo[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const viewerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { sidebarWidth, marginWidth, onSidebarDragStart, onMarginDragStart } =
    useColumnResize();

  useInitDocument();

  const handleOpenFile = useCallback(
    () => openFileFromTauri(setDocument, fileInputRef)(),
    [setDocument],
  );

  useKeyboardShortcuts(handleOpenFile);

  const handleHeadingsChange = useCallback((nextHeadings: HeadingInfo[]) => {
    setHeadings(nextHeadings);
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file == null) return;
      const rawPath =
        (file as File & { path?: string; webkitRelativePath?: string }).path ??
        (file as File & { webkitRelativePath?: string }).webkitRelativePath ??
        file.name;

      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target?.result as string;
        if (content) {
          const { baseName } = getPathInfo(rawPath);
          setDocument({
            reply: content,
            target: null,
            targetPath: null,
            reviewPath: rawPath,
            replyPath: rawPath,
            workspacePath: resolveWorkspacePath({
              workspacePath: null,
              reviewPath: rawPath,
              replyPath: rawPath,
              targetPath: null,
            }),
            archivedSubmission: null,
            documentId: baseName || file.name,
            isReadOnly: false,
          });
        }
      };
      reader.onerror = () => {
        setError(`${t("app.readFileFail")}: ${file.name}`);
      };
      reader.readAsText(file);

      e.target.value = "";
    },
    [setDocument, setError, t],
  );

  if (error && !replyContent) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-surface-app">
        <div className="max-w-md space-y-4 text-center" data-testid="error-view">
          <AlertCircle className="mx-auto h-12 w-12 text-kind-challenge-text" />
          <h2 className="text-lg font-semibold text-text-strong">
            {t("app.errorTitle")}
          </h2>
          <p className="text-sm text-text-muted">{error}</p>
          <p className="text-xs text-text-subtle">
            {t("app.errorHint")}{" "}
            <code className="bg-surface-card px-1 rounded">cliv &lt;file.md&gt;</code>{" "}
            {t("app.errorHintOpen")}
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-surface-app">
        <div className="flex items-center gap-3 text-text-muted">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">{t("app.loading")}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex h-screen w-screen flex-col overflow-hidden bg-surface-app text-text-primary"
      data-testid="app-shell"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.markdown,.txt"
        onChange={handleFileInputChange}
        className="hidden"
        data-testid="browser-file-input"
      />

      <TopBar
        sidebarOpen={sidebarOpen}
        onToggleSidebar={toggleSidebarOpen}
        onOpenFile={handleOpenFile}
        scrollContainerRef={scrollContainerRef}
        settingsOpen={settingsOpen}
        onToggleSettings={() => setSettingsOpen((v) => !v)}
      />

      <div className="flex flex-1 overflow-hidden">
        {sidebarOpen && (
          <LeftSidebar
            width={sidebarWidth}
            headings={headings}
            onDragStart={onSidebarDragStart}
          />
        )}

        <DocumentArea
          replyContent={replyContent}
          viewerRef={viewerRef}
          scrollContainerRef={scrollContainerRef}
          marginWidth={marginWidth}
          onMarginDragStart={onMarginDragStart}
          onHeadingsChange={handleHeadingsChange}
          onOpenFile={handleOpenFile}
        />

        <PersonalizationPanel
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
        />
      </div>
    </div>
  );
}
