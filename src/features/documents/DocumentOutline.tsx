import { memo, useCallback } from "react";
import type { HeadingInfo } from "./MarkdownViewer";
import { useT } from "@/lib/useT";

interface DocumentOutlineProps {
  headings: HeadingInfo[];
  className?: string;
}

/**
 * DocumentOutline — renders H1-H6 heading tree with click-to-scroll.
 */
export const DocumentOutline = memo(function DocumentOutline({
  headings,
  className,
}: DocumentOutlineProps) {
  const t = useT();

  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  if (headings.length === 0) {
    return (
      <div className={`p-4 text-xs text-text-subtle ${className || ""}`}>
        {t("outline.noHeadings")}
      </div>
    );
  }

  // Find minimum heading level for indentation
  const minLevel = Math.min(...headings.map((h) => h.level));

  return (
    <nav
      className={`space-y-0.5 p-3 ${className || ""}`}
      data-testid="document-outline"
      aria-label={t("outline.ariaLabel")}
    >
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-subtle">
        {t("outline.toc")}
      </div>
      {headings.map((heading) => (
        <button
          key={heading.id}
          onClick={() => scrollTo(heading.id)}
          className="group flex w-full items-start rounded px-2 py-1 text-left text-sm transition-colors hover:bg-surface-hover"
          style={{ paddingLeft: `${(heading.level - minLevel) * 12 + 8}px` }}
          title={heading.text}
        >
          <span className="truncate text-text-muted group-hover:text-text-primary transition-colors">
            {heading.text}
          </span>
        </button>
      ))}
    </nav>
  );
});
