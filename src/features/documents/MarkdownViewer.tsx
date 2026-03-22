import { memo, useRef, useEffect, useState, useCallback, isValidElement } from "react";
import MarkdownPreview from "@uiw/react-markdown-preview";
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

/** Derive color-mode from the root data-theme attribute. */
function getColorModeFromRoot(): "light" | "dark" {
  const theme = document.documentElement.getAttribute("data-theme");
  return theme === "light" ? "light" : "dark";
}

/**
 * MarkdownViewer — renders Markdown with @uiw/react-markdown-preview.
 * Built-in: syntax highlighting, GitHub styling, GFM, GitHub Alerts.
 * Custom: Mermaid blocks, image lightbox, heading extraction.
 *
 * Theme handling: instead of subscribing to the Zustand store (which would
 * cause a full re-render of MarkdownPreview on every theme change), we
 * observe `data-theme` on <html> via MutationObserver and update
 * `data-color-mode` on the wrapper div directly through the DOM.
 * Our CSS overrides in globals.css already handle all actual color changes
 * through CSS variables, so this attribute is only needed for the library's
 * internal style selection.
 */
export const MarkdownViewer = memo(function MarkdownViewer({
  content,
  className,
  containerRef,
  onHeadingsChange,
}: MarkdownViewerProps) {
  const fallbackRef = useRef<HTMLDivElement>(null);
  const ref = containerRef ?? fallbackRef;
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // Read initial color mode once (no store subscription).
  const initialColorMode = useRef(getColorModeFromRoot());

  // Observe data-theme changes on <html> and update wrapper DOM directly.
  useEffect(() => {
    const wrapper = ref.current;
    if (!wrapper) return;

    // Find the element with data-color-mode (MarkdownPreview's wrapper).
    const updateColorMode = () => {
      const mode = getColorModeFromRoot();
      const target = wrapper.querySelector("[data-color-mode]");
      if (target) {
        target.setAttribute("data-color-mode", mode);
      }
    };

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.attributeName === "data-theme") {
          updateColorMode();
          break;
        }
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => observer.disconnect();
  }, [ref]);

  const openLightbox = useCallback((src: string) => {
    setLightboxSrc(src);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxSrc(null);
  }, []);

  useEffect(() => {
    if (onHeadingsChange == null || ref.current == null) return;

    const timer = requestAnimationFrame(() => {
      const container = ref.current;
      if (container == null) return;

      const headingEls = container.querySelectorAll("h1, h2, h3, h4, h5, h6");
      const headings: HeadingInfo[] = Array.from(headingEls).map((el, i) => {
        const id = el.id || "heading-" + i;
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

  const rootClassName = ["cliv-markdown-preview max-w-none", className || ""]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <div
        ref={ref}
        className={rootClassName}
        style={{
          padding:
            "var(--viewer-padding-y, 24px) var(--viewer-padding-x, 48px)",
        }}
        data-testid="markdown-viewer"
      >
        <MarkdownPreview
          source={content}
          wrapperElement={{
            "data-color-mode": initialColorMode.current,
          }}
          components={{
            pre: ({ children, ...props }) => {
              const codeChild = findCodeChild(children);
              if (codeChild) {
                const lang = getLangFromClassName(codeChild.props?.className);
                if (lang === "mermaid") {
                  const codeText = extractTextFromNode(codeChild);
                  return <MermaidBlock chart={codeText} />;
                }
              }
              return <pre {...props}>{children}</pre>;
            },
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

      {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={closeLightbox} />}
    </>
  );
});

type CodeChildElement = React.ReactElement<{
  className?: string;
  children?: React.ReactNode;
}>;

function isCodeChild(node: React.ReactNode): node is CodeChildElement {
  return isValidElement(node) && node.type === "code";
}

function findCodeChild(children: React.ReactNode): CodeChildElement | null {
  if (children == null) return null;
  if (isCodeChild(children)) {
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

function getLangFromClassName(className?: string): string {
  if (!className) return "";
  const match = /language-(\w+)/.exec(className);
  return match ? match[1] : "";
}

function extractTextFromNode(node: React.ReactNode): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number" || typeof node === "boolean") return String(node);
  if (Array.isArray(node)) return node.map(extractTextFromNode).join("");
  if (typeof node === "object") {
    if ("props" in node) {
      const el = node as { props?: { children?: React.ReactNode } };
      return extractTextFromNode(el.props?.children);
    }
  }
  return String(node);
}
