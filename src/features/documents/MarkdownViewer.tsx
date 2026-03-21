import { memo, useRef, useEffect, useState, useCallback } from "react";
import MarkdownPreview from "@uiw/react-markdown-preview";
import { useUIStore } from "@/stores/uiStore";
import { MermaidBlock } from "./MermaidBlock";
import { ImageLightbox } from "./ImageLightbox";

interface MarkdownViewerProps {
  content: string;
  className?: string;
  containerRef?: React.RefObject<HTMLDivElement | null>;
  onHeadingsChange?: (headings: HeadingInfo[]) => void;
}

export interface HeadingInfo {
  id: string;
  text: string;
  level: number;
}

/**
 * MarkdownViewer — renders Markdown with @uiw/react-markdown-preview.
 * Built-in: syntax highlighting, GitHub styling, GFM, GitHub Alerts.
 * Custom: Mermaid blocks, image lightbox, heading extraction.
 */
export const MarkdownViewer = memo(function MarkdownViewer({
  content,
  className,
  containerRef,
  onHeadingsChange,
}: MarkdownViewerProps) {
  const fallbackRef = useRef<HTMLDivElement>(null);
  const ref = containerRef ?? fallbackRef;
  const theme = useUIStore((s) => s.theme);

  // Image lightbox state
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const openLightbox = useCallback((src: string) => {
    setLightboxSrc(src);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxSrc(null);
  }, []);

  // Extract headings after render for DocumentOutline
  useEffect(() => {
    if (!onHeadingsChange || !ref.current) return;

    const timer = requestAnimationFrame(() => {
      const container = ref.current;
      if (!container) return;

      const headingEls = container.querySelectorAll("h1, h2, h3, h4, h5, h6");
      const headings: HeadingInfo[] = Array.from(headingEls).map((el, i) => {
        const id = el.id || `heading-${i}`;
        if (!el.id) el.id = id;
        return {
          id,
          text: el.textContent || "",
          level: parseInt(el.tagName.charAt(1), 10),
        };
      });
      onHeadingsChange(headings);
    });

    return () => cancelAnimationFrame(timer);
  }, [content, onHeadingsChange, ref]);

  // Map our theme to data-color-mode: "dark" | "dim" → "dark", "light" → "light"
  const colorMode = theme === "light" ? "light" : "dark";

  return (
    <>
      <div
        ref={ref}
        className={`cliv-markdown-preview max-w-none px-12 py-6 ${className || ""}`}
        data-testid="markdown-viewer"
      >
        <MarkdownPreview
          source={content}
          wrapperElement={{
            "data-color-mode": colorMode,
          }}
          components={{
            // Override pre to intercept Mermaid code blocks before rendering
            pre: ({ children, ...props }) => {
              // Check if this pre contains a mermaid code block
              const codeChild = findCodeChild(children);
              if (codeChild) {
                const lang = getLangFromClassName(codeChild.props?.className);
                if (lang === "mermaid") {
                  // Extract raw text from the original markdown source
                  const codeText = extractTextFromNode(codeChild);
                  return <MermaidBlock chart={codeText} />;
                }
              }
              return <pre {...props}>{children}</pre>;
            },
            // Override img to support lightbox click-to-zoom
            img: ({ src, alt, ...props }) => (
              <img
                src={src}
                alt={alt || ""}
                className="cursor-zoom-in"
                onClick={(e) => {
                  e.preventDefault();
                  if (src) openLightbox(src);
                }}
                {...props}
              />
            ),
          }}
        />
      </div>

      {lightboxSrc && (
        <ImageLightbox src={lightboxSrc} onClose={closeLightbox} />
      )}
    </>
  );
});

// ─── Helpers ──────────────────────────────────────────────

/**
 * Find a <code> React element within children (direct child of <pre>).
 */
function findCodeChild(
  children: React.ReactNode,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any | null {
  if (children == null) return null;
  if (
    typeof children === "object" &&
    "type" in children &&
    (children as { type: unknown }).type === "code"
  ) {
    return children;
  }
  if (Array.isArray(children)) {
    for (const child of children) {
      const found = findCodeChild(child);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Extract language from className like "language-mermaid" or "language-js".
 */
function getLangFromClassName(className?: string): string {
  if (!className) return "";
  const match = /language-(\w+)/.exec(className);
  return match ? match[1] : "";
}

/**
 * Recursively extract plain text from a React element tree.
 * @uiw/react-markdown-preview wraps code tokens in <span> elements
 * for syntax highlighting; this unwraps them to get raw text
 * needed by MermaidBlock.
 */
function extractTextFromNode(node: React.ReactNode): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number" || typeof node === "boolean") return String(node);
  if (Array.isArray(node)) return node.map(extractTextFromNode).join("");
  if (typeof node === "object") {
    // React element with props.children
    if ("props" in node) {
      const el = node as { props?: { children?: React.ReactNode } };
      return extractTextFromNode(el.props?.children);
    }
  }
  return String(node);
}
