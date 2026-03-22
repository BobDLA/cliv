import { useCallback, useRef } from "react";
import {
  clampMarginWidth,
  clampSidebarWidth,
  useUIStore,
} from "@/stores/uiStore";

/**
 * Hook: manage resizable column widths for sidebar and annotation margin.
 *
 * Returns current widths + mousedown handlers for the resize handles.
 */
export function useColumnResize() {
  const sidebarWidth = useUIStore((state) => state.sidebarWidth);
  const marginWidth = useUIStore((state) => state.marginWidth);
  const setSidebarWidth = useUIStore((state) => state.setSidebarWidth);
  const setMarginWidth = useUIStore((state) => state.setMarginWidth);

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
        if (sidebarDragRef.current == null) return;
        const delta = ev.clientX - sidebarDragRef.current.startX;
        setSidebarWidth(clampSidebarWidth(sidebarDragRef.current.startW + delta));
      };

      const onUp = () => {
        sidebarDragRef.current = null;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [setSidebarWidth, sidebarWidth],
  );

  const onMarginDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      marginDragRef.current = { startX: e.clientX, startW: marginWidth };

      const onMove = (ev: MouseEvent) => {
        if (marginDragRef.current == null) return;
        const delta = marginDragRef.current.startX - ev.clientX;
        setMarginWidth(clampMarginWidth(marginDragRef.current.startW + delta));
      };

      const onUp = () => {
        marginDragRef.current = null;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [marginWidth, setMarginWidth],
  );

  return {
    sidebarWidth,
    marginWidth,
    onSidebarDragStart,
    onMarginDragStart,
  };
}
