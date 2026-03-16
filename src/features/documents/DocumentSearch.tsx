import { useState, useCallback, useEffect, useRef, memo } from "react";
import { Search, X } from "lucide-react";

interface DocumentSearchProps {
  containerRef: React.RefObject<HTMLElement | null>;
  className?: string;
}

/**
 * DocumentSearch — Ctrl+F in-document search with match highlighting.
 */
export const DocumentSearch = memo(function DocumentSearch({
  containerRef,
  className,
}: DocumentSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [matchCount, setMatchCount] = useState(0);
  const [currentMatch, setCurrentMatch] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Toggle search with Ctrl+F
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setIsOpen((prev) => {
          if (!prev) {
            // Will focus after render
            requestAnimationFrame(() => inputRef.current?.focus());
          }
          return !prev;
        });
      }
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
        setQuery("");
        clearHighlights();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  const clearHighlights = useCallback(() => {
    if (typeof CSS !== "undefined" && CSS.highlights) {
      CSS.highlights.delete("search-results");
      CSS.highlights.delete("search-current");
    }
    setMatchCount(0);
    setCurrentMatch(0);
  }, []);

  const search = useCallback(
    (searchQuery: string) => {
      clearHighlights();
      if (!searchQuery || !containerRef.current) return;

      const container = containerRef.current;
      const walker = document.createTreeWalker(
        container,
        NodeFilter.SHOW_TEXT,
      );
      const ranges: Range[] = [];
      const lowerQuery = searchQuery.toLowerCase();
      let node: Node | null;

      while ((node = walker.nextNode())) {
        const text = (node.textContent || "").toLowerCase();
        let startIndex = 0;
        let idx: number;

        while ((idx = text.indexOf(lowerQuery, startIndex)) !== -1) {
          const range = new Range();
          range.setStart(node, idx);
          range.setEnd(node, idx + searchQuery.length);
          ranges.push(range);
          startIndex = idx + 1;
        }
      }

      if (ranges.length > 0 && CSS.highlights) {
        const highlight = new Highlight(...ranges);
        CSS.highlights.set("search-results", highlight);
        setMatchCount(ranges.length);
        setCurrentMatch(ranges.length > 0 ? 1 : 0);

        // Scroll to first match
        const firstRange = ranges[0];
        const rect = firstRange.getBoundingClientRect();
        if (rect) {
          const el = firstRange.startContainer.parentElement;
          el?.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      } else {
        setMatchCount(0);
        setCurrentMatch(0);
      }
    },
    [containerRef, clearHighlights],
  );

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => search(query), 200);
    return () => clearTimeout(timer);
  }, [query, search]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearHighlights();
  }, [clearHighlights]);

  if (!isOpen) return null;

  return (
    <div
      className={`flex items-center gap-2 rounded-lg border border-border-strong bg-surface-popover px-3 py-1.5 shadow-lg ${className || ""}`}
      data-testid="document-search"
    >
      <Search className="h-4 w-4 text-text-subtle" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="搜索文档..."
        className="w-48 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-faint"
      />
      {query && (
        <span className="text-xs text-text-subtle">
          {matchCount > 0 ? `${currentMatch}/${matchCount}` : "无结果"}
        </span>
      )}
      <button
        onClick={() => {
          setIsOpen(false);
          setQuery("");
          clearHighlights();
        }}
        className="rounded p-0.5 text-text-subtle hover:bg-surface-hover hover:text-text-primary transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
});
