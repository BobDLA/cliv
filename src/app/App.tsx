import { useEffect, useState, useCallback, useRef } from "react";
import { useUIStore, useDocumentStore } from "@/stores";
import { type HeadingInfo } from "@/features/documents";
import { AlertCircle, Loader2 } from "lucide-react";
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
  const { theme } = useUIStore();
  const { replyContent, isLoading, error, setDocument, setError } =
    useDocumentStore();
  const t = useT();

  const [headings, setHeadings] = useState<HeadingInfo[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const viewerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Custom hooks ──
  const { sidebarWidth, marginWidth, onSidebarDragStart, onMarginDragStart } =
    useColumnResize();

  useInitDocument();

  const handleOpenFile = useCallback(
    () => openFileFromTauri(setDocument, fileInputRef)(),
    [setDocument],
  );

  useKeyboardShortcuts(handleOpenFile);

  // Init theme on mount
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const handleHeadingsChange = useCallback((h: HeadingInfo[]) => {
    setHeadings(h);
  }, []);

  // Browser file input change handler
  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

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
        setError(`${t("app.readFileFail")}: ${file.name}`);
      };
      reader.readAsText(file);

      // Reset input so same file can be reopened
      e.target.value = "";
    },
    [setDocument, setError, t],
  );

  // ─── Error State ────────────────────────────────────────
  if (error && !replyContent) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-surface-app">
        <div className="max-w-md space-y-4 text-center" data-testid="error-view">
          <AlertCircle className="mx-auto h-12 w-12 text-kind-challenge-text" />
          <h2 className="text-lg font-semibold text-text-strong">{t("app.errorTitle")}</h2>
          <p className="text-sm text-text-muted">{error}</p>
          <p className="text-xs text-text-subtle">
            {t("app.errorHint")}{" "}
            <code className="bg-surface-card px-1 rounded">
              cliv &lt;file.md&gt;
            </code>{" "}
            {t("app.errorHintOpen")}
          </p>
        </div>
      </div>
    );
  }

  // ─── Loading State ──────────────────────────────────────
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

  // ─── Normal layout ──────────────────────────────────────
  return (
    <div
      className="flex h-screen w-screen flex-col overflow-hidden bg-surface-app text-text-primary"
      data-testid="app-shell"
    >
      {/* Hidden file input for browser open */}
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
        onToggleSidebar={() => setSidebarOpen((s) => !s)}
        onOpenFile={handleOpenFile}
        scrollContainerRef={scrollContainerRef}
      />

      {/* ─── Body: sidebar + content ─────────────────────── */}
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
      </div>
    </div>
  );
}
