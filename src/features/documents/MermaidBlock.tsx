import { useEffect, useRef, useState, memo } from "react";
import mermaid from "mermaid";

interface MermaidBlockProps {
  chart: string;
}

// Initialize mermaid once
let mermaidInitialized = false;
function ensureMermaidInit() {
  if (mermaidInitialized) return;
  mermaid.initialize({
    startOnLoad: false,
    theme: "dark",
    securityLevel: "loose",
    fontFamily: "var(--font-sans)",
  });
  mermaidInitialized = true;
}

/**
 * MermaidBlock — renders a Mermaid diagram from a code string.
 * Falls back to showing the raw code on render failure (silent degradation).
 */
export const MermaidBlock = memo(function MermaidBlock({
  chart,
}: MermaidBlockProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      ensureMermaidInit();
      const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      try {
        const { svg } = await mermaid.render(id, chart);
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
          setRendered(true);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Mermaid render failed");
          setRendered(false);
        }
      }
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [chart]);

  if (error) {
    return (
      <div className="mb-4 rounded-lg border border-kind-challenge/30 bg-kind-challenge-bg p-4">
        <div className="mb-2 text-xs font-medium text-kind-challenge-text">
          Mermaid 渲染失败
        </div>
        <pre className="overflow-x-auto font-mono text-xs text-text-muted">
          {chart}
        </pre>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`my-4 flex justify-center ${rendered ? "" : "min-h-[80px] animate-pulse rounded-lg bg-surface-card"}`}
      data-testid="mermaid-block"
    />
  );
});
