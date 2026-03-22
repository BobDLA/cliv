import { useEffect, useRef, useState, memo, useCallback } from "react";
import mermaid from "mermaid";
import { ImageLightbox } from "@/features/documents/ImageLightbox";

interface MermaidBlockProps {
  chart: string;
}

/** Derive mermaid theme from root data-theme attribute. */
function getMermaidThemeFromRoot(): "default" | "dark" {
  const theme = document.documentElement.getAttribute("data-theme");
  return theme === "light" ? "default" : "dark";
}

/**
 * MermaidBlock — renders a Mermaid diagram from a code string.
 * Theme-aware: uses "default" for light, "dark" for dark/dim.
 * Click-to-zoom: renders SVG to a data URL and opens in lightbox.
 * Falls back to showing the raw code on render failure (silent degradation).
 *
 * Theme handling: observes `data-theme` on <html> via MutationObserver
 * instead of subscribing to the Zustand store, and debounces re-renders
 * to avoid queuing multiple expensive SVG generations during rapid toggling.
 */
export const MermaidBlock = memo(function MermaidBlock({
  chart,
}: MermaidBlockProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [rendered, setRendered] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // Track mermaid theme via MutationObserver, debounced.
  const [mermaidTheme, setMermaidTheme] = useState(getMermaidThemeFromRoot);

  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.attributeName === "data-theme") {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            setMermaidTheme(getMermaidThemeFromRoot());
          }, 300);
          break;
        }
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => {
      observer.disconnect();
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      // Re-initialize with current theme every render
      mermaid.initialize({
        startOnLoad: false,
        theme: mermaidTheme,
        securityLevel: "loose",
        fontFamily: "var(--font-sans)",
      });

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
  }, [chart, mermaidTheme]);

  // Click-to-zoom: convert SVG to data URL for fullscreen lightbox
  const handleClick = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const svgEl = container.querySelector("svg");
    if (!svgEl) return;

    // Serialize SVG to data URL
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    setLightboxSrc(url);
  }, []);

  const closeLightbox = useCallback(() => {
    if (lightboxSrc) {
      URL.revokeObjectURL(lightboxSrc);
    }
    setLightboxSrc(null);
  }, [lightboxSrc]);

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
    <>
      <div
        ref={containerRef}
        onClick={handleClick}
        className={`my-4 flex cursor-zoom-in justify-center ${rendered ? "" : "min-h-[80px] animate-pulse rounded-lg bg-surface-card"}`}
        data-testid="mermaid-block"
        title="点击放大"
      />
      {lightboxSrc && (
        <ImageLightbox src={lightboxSrc} onClose={closeLightbox} />
      )}
    </>
  );
});
