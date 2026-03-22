import { useEffect } from "react";
import { useDocumentStore, useSelectionStore, useUIStore } from "@/stores";

/**
 * Hook: register global keyboard shortcuts and Ctrl+Wheel zoom.
 *
 * Shortcuts:
 *   Ctrl+= / Ctrl+- / Ctrl+0 — font size
 *   Ctrl+Alt+M — add annotation
 *   Ctrl+O — open file
 */
export function useKeyboardShortcuts(handleOpenFile: () => void) {
  const adjustFontSize = useUIStore((state) => state.adjustFontSize);
  const setFontSize = useUIStore((state) => state.setFontSize);

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
          setFontSize(18);
        } else if (e.key === "m" && e.altKey) {
          e.preventDefault();
          if (useDocumentStore.getState().isReadOnly) {
            return;
          }
          const selection = useSelectionStore.getState().selection;
          if (selection) {
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
  }, [adjustFontSize, handleOpenFile, setFontSize]);
}
