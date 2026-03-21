import { FolderOpen } from "lucide-react";
import { useDocumentStore } from "@/stores";
import { MarkdownViewer, type HeadingInfo } from "@/features/documents";
import {
  SelectionCatcher,
  AnnotationPopup,
  ParagraphBubble,
  AnnotationOverlay,
  AnnotationList,
  AnnotationHoverActions,
} from "@/features/annotations";
import { ReturnBuilder } from "@/features/return";
import { ResizeHandle } from "./ResizeHandle";
import { useT } from "@/lib/useT";

interface DocumentAreaProps {
  replyContent: string | null;
  viewerRef: React.RefObject<HTMLDivElement | null>;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  marginWidth: number;
  onMarginDragStart: (e: React.MouseEvent) => void;
  onHeadingsChange: (h: HeadingInfo[]) => void;
  onOpenFile: () => void;
}

export function DocumentArea({
  replyContent,
  viewerRef,
  scrollContainerRef,
  marginWidth,
  onMarginDragStart,
  onHeadingsChange,
  onOpenFile,
}: DocumentAreaProps) {
  const t = useT();
  const isReadOnly = useDocumentStore((state) => state.isReadOnly);

  return (
    <main className="relative flex flex-1 flex-col overflow-hidden">
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
        <div className="flex">
          <div
            className="flex-1 min-w-0"
            style={{ padding: "0 var(--content-shell-padding, 24px)" }}
          >
            {replyContent ? (
              <div
                className="relative mx-auto"
                style={{ maxWidth: "var(--content-max-width, 56rem)" }}
                ref={viewerRef}
                data-viewer-root
              >
                <MarkdownViewer
                  content={replyContent}
                  containerRef={viewerRef}
                  onHeadingsChange={onHeadingsChange}
                />

                {!isReadOnly ? <SelectionCatcher containerRef={viewerRef} /> : null}
                <AnnotationOverlay containerRef={viewerRef} />
                {!isReadOnly ? (
                  <>
                    <AnnotationHoverActions containerRef={viewerRef} />
                    <ParagraphBubble containerRef={viewerRef} />
                    <AnnotationPopup />
                  </>
                ) : null}
              </div>
            ) : (
              <div className="flex h-full min-h-[60vh] flex-1 items-center justify-center">
                <div className="flex max-w-lg -translate-y-12 transform flex-col items-center justify-center gap-6 text-center">
                  <div className="mb-2 text-5xl opacity-80">📖</div>
                  <h2 className="text-3xl font-bold tracking-tight text-text-strong">
                    cliV v0.2
                  </h2>
                  <p className="text-base leading-relaxed text-text-muted">
                    {t("docarea.hintUse")}{" "}
                    <code className="mx-1 rounded-md border border-border-subtle bg-surface-card px-1.5 py-0.5 text-sm font-mono text-text-primary">
                      cliv &lt;file.md&gt;
                    </code>{" "}
                    <br className="hidden sm:block" />
                    {t("docarea.hint")}
                  </p>
                  <button
                    onClick={onOpenFile}
                    className="mt-4 inline-flex items-center gap-2.5 rounded-xl bg-accent px-6 py-3 text-base font-semibold text-white shadow-lg shadow-accent/20 transition-all hover:-translate-y-0.5 hover:bg-accent/90 hover:shadow-xl active:scale-95"
                  >
                    <FolderOpen className="h-5 w-5" />
                    {t("docarea.openMarkdown")}
                  </button>
                </div>
              </div>
            )}
          </div>

          <ResizeHandle onDragStart={onMarginDragStart} />

          <div
            style={{ width: `${marginWidth}px` }}
            className="relative shrink-0"
          >
            <AnnotationList
              viewerRef={viewerRef}
              scrollContainerRef={scrollContainerRef}
            />
          </div>
        </div>
      </div>

      {!isReadOnly ? (
        <div style={{ display: "flex", flexShrink: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <ReturnBuilder />
          </div>
          <div
            style={{
              width: `${marginWidth + 6}px`,
              borderLeft: "1px solid var(--color-border-subtle)",
            }}
            className="shrink-0"
          />
        </div>
      ) : null}
    </main>
  );
}
