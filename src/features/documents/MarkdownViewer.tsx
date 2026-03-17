import { memo, useMemo, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { MermaidBlock } from "./MermaidBlock";

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
 * MarkdownViewer — renders Markdown with code highlighting, Mermaid, and GFM.
 * Designed for performance: no inline styles, Tailwind utility classes.
 */
export const MarkdownViewer = memo(function MarkdownViewer({
  content,
  className,
  containerRef,
  onHeadingsChange,
}: MarkdownViewerProps) {
  const fallbackRef = useRef<HTMLDivElement>(null);
  const ref = containerRef ?? fallbackRef;

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

  // Custom components for react-markdown
  const components: Components = useMemo(
    () => ({
      // Headings with auto-generated IDs for anchor links
      h1: ({ children, ...props }) => {
        const text = extractText(children);
        const id = slugify(text);
        return (
          <h1
            id={id}
            className="mt-8 mb-4 border-b border-border-subtle pb-2 text-[2em] font-semibold tracking-tight text-text-strong"
            {...props}
          >
            {children}
          </h1>
        );
      },
      h2: ({ children, ...props }) => {
        const text = extractText(children);
        const id = slugify(text);
        return (
          <h2
            id={id}
            className="mt-6 mb-4 border-b border-border-subtle pb-2 text-[1.5em] font-semibold tracking-tight text-text-strong"
            {...props}
          >
            {children}
          </h2>
        );
      },
      h3: ({ children, ...props }) => {
        const text = extractText(children);
        const id = slugify(text);
        return (
          <h3
            id={id}
            className="mt-6 mb-4 text-[1.25em] font-semibold tracking-tight text-text-strong"
            {...props}
          >
            {children}
          </h3>
        );
      },
      h4: ({ children, ...props }) => {
        const text = extractText(children);
        const id = slugify(text);
        return (
          <h4
            id={id}
            className="mt-5 mb-3 text-[1em] font-semibold tracking-tight text-text-strong"
            {...props}
          >
            {children}
          </h4>
        );
      },
      h5: ({ children, ...props }) => {
        const text = extractText(children);
        const id = slugify(text);
        return (
          <h5
            id={id}
            className="mt-4 mb-2 text-[0.875em] font-semibold tracking-tight text-text-strong"
            {...props}
          >
            {children}
          </h5>
        );
      },
      h6: ({ children, ...props }) => {
        const text = extractText(children);
        const id = slugify(text);
        return (
          <h6
            id={id}
            className="mt-4 mb-2 text-[0.85em] font-semibold tracking-tight text-text-muted"
            {...props}
          >
            {children}
          </h6>
        );
      },

      // Paragraphs
      p: ({ children, ...props }) => (
        <p className="mb-4 text-[0.95em] leading-[1.65] text-text-primary" {...props}>
          {children}
        </p>
      ),

      // Code blocks
      code: ({ className: codeClassName, children, ...props }) => {
        const match = /language-(\w+)/.exec(codeClassName || "");
        const lang = match ? match[1] : "";
        const codeStr = String(children).replace(/\n$/, "");

        // Mermaid blocks
        if (lang === "mermaid") {
          return <MermaidBlock chart={codeStr} />;
        }

        // Inline code
        if (!codeClassName) {
          return (
            <code
              className="rounded-md bg-surface-hover px-[0.4em] py-[0.15em] font-mono text-[0.85em] text-text-strong"
              {...props}
            >
              {children}
            </code>
          );
        }

        // Block code
        return (
          <div className="group relative mb-4">
            {lang && (
              <div className="absolute right-2 top-2 rounded bg-surface-card-strong px-2 py-0.5 font-sans text-[0.7rem] font-medium text-text-subtle opacity-0 transition-opacity group-hover:opacity-100">
                {lang}
              </div>
            )}
            <pre className="overflow-x-auto rounded-xl border border-border-subtle bg-surface-card p-4 font-mono text-[0.85em] leading-[1.6]">
              <code className={codeClassName} {...props}>
                {children}
              </code>
            </pre>
          </div>
        );
      },

      // Blockquotes
      blockquote: ({ children, ...props }) => (
        <blockquote
          className="my-4 border-l-4 border-border-strong pl-4 text-text-subtle"
          {...props}
        >
          {children}
        </blockquote>
      ),

      // Lists
      ul: ({ children, ...props }) => (
        <ul className="mb-4 ml-5 list-disc space-y-2 text-[0.95em]" {...props}>
          {children}
        </ul>
      ),
      ol: ({ children, ...props }) => (
        <ol className="mb-4 ml-5 list-decimal space-y-2 text-[0.95em]" {...props}>
          {children}
        </ol>
      ),
      li: ({ children, ...props }) => (
        <li className="leading-[1.65] text-text-primary" {...props}>
          {children}
        </li>
      ),

      // Tables
      table: ({ children, ...props }) => (
        <div className="mb-4 overflow-x-auto rounded-lg border border-border-strong">
          <table
            className="w-full border-collapse text-[0.9em]"
            {...props}
          >
            {children}
          </table>
        </div>
      ),
      thead: ({ children, ...props }) => (
        <thead className="bg-surface-card-strong border-b border-border-strong" {...props}>
          {children}
        </thead>
      ),
      tr: ({ children, ...props }) => (
        <tr className="even:bg-surface-hover border-b border-border-subtle last:border-0" {...props}>
          {children}
        </tr>
      ),
      th: ({ children, ...props }) => (
        <th
          className="border-x border-border-subtle px-4 py-2 text-left font-semibold text-text-strong"
          {...props}
        >
          {children}
        </th>
      ),
      td: ({ children, ...props }) => (
        <td
          className="border-x border-border-subtle px-4 py-2 text-text-primary"
          {...props}
        >
          {children}
        </td>
      ),

      // Links
      a: ({ children, href, ...props }) => (
        <a
          href={href}
          className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent transition-colors"
          target="_blank"
          rel="noopener noreferrer"
          {...props}
        >
          {children}
        </a>
      ),

      // Horizontal rule
      hr: () => <hr className="my-6 border-border-subtle" />,

      // Strong / em
      strong: ({ children, ...props }) => (
        <strong className="font-semibold text-text-strong" {...props}>
          {children}
        </strong>
      ),

      // Images
      img: ({ src, alt, ...props }) => (
        <img
          src={src}
          alt={alt}
          className="my-4 max-w-full rounded-lg border border-border-subtle"
          loading="lazy"
          {...props}
        />
      ),
    }),
    [],
  );

  return (
    <div
      ref={ref}
      className={`prose-custom max-w-none px-8 py-6 ${className || ""}`}
      data-testid="markdown-viewer"
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
});

// ─── Helpers ──────────────────────────────────────────────

function extractText(children: React.ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(extractText).join("");
  if (
    children != null &&
    typeof children === "object" &&
    "props" in children
  ) {
    const el = children as { props: { children?: React.ReactNode } };
    return extractText(el.props.children);
  }
  return String(children ?? "");
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
