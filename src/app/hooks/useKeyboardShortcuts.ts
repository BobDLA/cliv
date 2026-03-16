import { useEffect } from "react";
import { useUIStore, useSelectionStore } from "@/stores";

/**
 * Hook: register global keyboard shortcuts and Ctrl+Wheel zoom.
 *
 * Shortcuts:
 *   Ctrl+= / Ctrl+- / Ctrl+0 — font size
 *   Ctrl+Alt+M — add annotation
 *   Ctrl+O — open file
 */
export function useKeyboardShortcuts(handleOpenFile: () => void) {
  const { adjustFontSize } = useUIStore();

  // Ctrl+Wheel zoom
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        useUIStore.getState().adjustFontSize(e.deltaY > 0 ? -1 : 1);
      }
    };
    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "=" || e.key === "+") {
          e.preventDefault();
          adjustFontSize(1);
        } else if (e.key === "-") {
          e.preventDefault();
          adjustFontSize(-1);
        } else if (e.key === "0") {
          e.preventDefault();
          useUIStore.getState().setFontSize(14);
        } else if (e.key === "m" && e.altKey) {
          // Ctrl+Alt+M → trigger comment
          e.preventDefault();
          const sel = useSelectionStore.getState().selection;
          if (sel) {
            useSelectionStore.getState().openPopup();
          }
        } else if (e.key === "o") {
          e.preventDefault();
          handleOpenFile();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [adjustFontSize, handleOpenFile]);
}
