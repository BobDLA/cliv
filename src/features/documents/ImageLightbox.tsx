import { useEffect, useCallback, useRef, useState } from "react";

interface ImageLightboxProps {
  src: string;
  alt?: string;
  onClose: () => void;
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 5;
const ZOOM_STEP = 0.15;

/**
 * ImageLightbox — fullscreen overlay for viewing images/SVGs at full size.
 * Features:
 *   - Scroll wheel to zoom in/out
 *   - Click and drag to pan
 *   - Double-click to reset zoom/position
 *   - Esc or click backdrop to close
 */
export function ImageLightbox({ src, alt, onClose }: ImageLightboxProps) {
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const lastTranslate = useRef({ x: 0, y: 0 });
  const imgRef = useRef<HTMLImageElement>(null);

  // ─── Keyboard ──────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      // +/= to zoom in, - to zoom out, 0 to reset
      if (e.key === "=" || e.key === "+") {
        setScale((s) => Math.min(MAX_SCALE, s + ZOOM_STEP));
      }
      if (e.key === "-") {
        setScale((s) => Math.max(MIN_SCALE, s - ZOOM_STEP));
      }
      if (e.key === "0") {
        setScale(1);
        setTranslate({ x: 0, y: 0 });
      }
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // ─── Scroll to zoom ────────────────────────────────────
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s + delta)));
  }, []);

  // ─── Drag to pan ───────────────────────────────────────
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return; // left button only
      e.preventDefault();
      isDragging.current = true;
      dragStart.current = { x: e.clientX, y: e.clientY };
      lastTranslate.current = { ...translate };
    },
    [translate],
  );

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setTranslate({
      x: lastTranslate.current.x + dx,
      y: lastTranslate.current.y + dy,
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  // ─── Double-click to reset ─────────────────────────────
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, []);

  // ─── Backdrop click to close (only if NOT dragged) ─────
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      // Only close if click is on the backdrop itself, not on the image
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  const isZoomed = scale !== 1 || translate.x !== 0 || translate.y !== 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={handleBackdropClick}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      data-testid="image-lightbox"
      style={{ cursor: isDragging.current ? "grabbing" : "default" }}
    >
      {/* Controls hint */}
      <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-lg bg-black/60 px-4 py-2 text-xs text-white/70 pointer-events-none select-none">
        滚轮缩放 · 拖拽移动 · 双击重置 · Esc 关闭
      </div>

      {/* Zoom indicator */}
      {isZoomed && (
        <div className="fixed right-4 top-4 z-50 rounded-lg bg-black/60 px-3 py-1.5 font-mono text-sm text-white/80 pointer-events-none">
          {Math.round(scale * 100)}%
        </div>
      )}

      {/* Image with transform */}
      <img
        ref={imgRef}
        src={src}
        alt={alt || ""}
        className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl select-none"
        style={{
          transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
          transition: isDragging.current ? "none" : "transform 0.15s ease-out",
          cursor: isDragging.current ? "grabbing" : "grab",
        }}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={handleDoubleClick}
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
        draggable={false}
      />
    </div>
  );
}
