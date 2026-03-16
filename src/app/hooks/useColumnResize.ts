import { useState, useCallback, useRef } from "react";

/**
 * Hook: manage resizable column widths for sidebar and annotation margin.
 *
 * Returns current widths + mousedown handlers for the resize handles.
 */
export function useColumnResize() {
  const [sidebarWidth, setSidebarWidth] = useState(224); // w-56 = 14rem
  const [marginWidth, setMarginWidth] = useState(256); // w-64 = 16rem

  const sidebarDragRef = useRef<{ startX: number; startW: number } | null>(
    null,
  );
  const marginDragRef = useRef<{ startX: number; startW: number } | null>(
    null,
  );

  const onSidebarDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      sidebarDragRef.current = { startX: e.clientX, startW: sidebarWidth };
      const onMove = (ev: MouseEvent) => {
        if (!sidebarDragRef.current) return;
        const delta = ev.clientX - sidebarDragRef.current.startX;
        setSidebarWidth(
          Math.max(120, Math.min(400, sidebarDragRef.current.startW + delta)),
        );
      };
      const onUp = () => {
        sidebarDragRef.current = null;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [sidebarWidth],
  );

  const onMarginDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      marginDragRef.current = { startX: e.clientX, startW: marginWidth };
      const onMove = (ev: MouseEvent) => {
        if (!marginDragRef.current) return;
        const delta = marginDragRef.current.startX - ev.clientX;
        setMarginWidth(
          Math.max(150, Math.min(500, marginDragRef.current.startW + delta)),
        );
      };
      const onUp = () => {
        marginDragRef.current = null;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [marginWidth],
  );

  return {
    sidebarWidth,
    marginWidth,
    onSidebarDragStart,
    onMarginDragStart,
  };
}
