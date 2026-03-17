import { FolderOpen } from "lucide-react";
import {
  MarkdownViewer,
  type HeadingInfo,
} from "@/features/documents";
import {
  SelectionCatcher,
  FloatingAnnotateButton,
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

  return (
    <main className="relative flex flex-1 flex-col overflow-hidden">
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
        <div className="flex">
          {/* Document column */}
          <div className="flex-1 min-w-0" style={{ padding: "0 24px" }}>
            {replyContent ? (
              <div
                className="relative mx-auto max-w-4xl"
                ref={viewerRef}
                data-viewer-root
              >
                <MarkdownViewer
                  content={replyContent}
                  containerRef={viewerRef}
                  onHeadingsChange={onHeadingsChange}
                />

                {/* M2: Annotation floating elements */}
                <SelectionCatcher containerRef={viewerRef} />
                <AnnotationOverlay containerRef={viewerRef} />
                <AnnotationHoverActions containerRef={viewerRef} />
                <ParagraphBubble containerRef={viewerRef} />
                <FloatingAnnotateButton />
                <AnnotationPopup />
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center h-full min-h-[60vh]">
                <div className="flex max-w-lg flex-col items-center justify-center gap-6 text-center transform -translate-y-12">
                  <div className="text-5xl opacity-80 mb-2">📖</div>
                  <h2 className="text-3xl font-bold text-text-strong tracking-tight">
                    cliV v0.2
                  </h2>
                  <p className="text-base text-text-muted leading-relaxed">
                    {t("docarea.hintUse")}{" "}
                    <code className="bg-surface-card px-1.5 py-0.5 rounded-md text-sm font-mono text-text-primary border border-border-subtle mx-1">
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

          {/* Annotation margin resize handle */}
          <ResizeHandle onDragStart={onMarginDragStart} />

          {/* Annotation margin — inside the same scroll container */}
          <div
            style={{ width: `${marginWidth}px` }}
            className="shrink-0 relative"
          >
            <AnnotationList
              viewerRef={viewerRef}
              scrollContainerRef={scrollContainerRef}
            />
          </div>
        </div>
      </div>

      {/* M3: ReturnBuilder — bottom panel, aligned to document column only */}
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
    </main>
  );
}
