import { useState, useCallback, useRef } from "react";
import { useUIStore, useDocumentStore } from "@/stores";
import { MarkdownViewer, type HeadingInfo } from "@/features/documents";
import { Minimize2, AlertCircle, Loader2 } from "lucide-react";
import { useT } from "@/lib/useT";

import { useInitDocument, openFileFromTauri } from "./hooks/useInitDocument";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useColumnResize } from "./hooks/useColumnResize";
import { TopBar } from "./components/TopBar";
import { LeftSidebar } from "./components/LeftSidebar";
import { DocumentArea } from "./components/DocumentArea";

/**
 * App shell — thin orchestrator.
 * All logic lives in extracted hooks; all UI in extracted components.
 */
export function App() {
  const isFullscreen = useUIStore((state) => state.isFullscreen);
  const toggleFullscreen = useUIStore((state) => state.toggleFullscreen);
  const sidebarOpen = useUIStore((state) => state.sidebarOpen);
  const toggleSidebarOpen = useUIStore((state) => state.toggleSidebarOpen);
  const {
    replyContent,
    reviewPath,
    isLoading,
    error,
    setDocument,
    setError,
  } = useDocumentStore();
  const t = useT();

  const [headings, setHeadings] = useState<HeadingInfo[]>([]);
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

      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target?.result as string;
        if (content) {
          setDocument({
            reply: content,
            target: null,
            targetPath: null,
            reviewPath: file.name,
            replyPath: file.name,
            documentId: file.name,
          });
        }
      };
      reader.onerror = () => {
        setError(t("app.readFileFail") + ": " + file.name);
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
          <h2 className="text-lg font-semibold text-text-strong">{t("app.errorTitle")}</h2>
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

  if (isFullscreen && replyContent) {
    return (
      <div
        className="fixed inset-0 z-50 overflow-auto bg-surface-app"
        data-testid="fullscreen-view"
      >
        <button
          onClick={toggleFullscreen}
          className="fixed right-4 top-4 z-50 rounded-lg border border-border-subtle bg-surface-popover p-2 text-text-muted shadow-lg hover:text-text-primary transition-colors"
          title={t("app.exitFullscreen")}
          data-testid="fullscreen-exit"
        >
          <Minimize2 className="h-4 w-4" />
        </button>
        <div className="mx-auto max-w-4xl px-8 py-6">
          <MarkdownViewer content={replyContent} />
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
      />

      <div className="flex flex-1 overflow-hidden">
        {sidebarOpen && (
          <LeftSidebar
            width={sidebarWidth}
            headings={headings}
            reviewPath={reviewPath}
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
      </div>
    </div>
  );
}
