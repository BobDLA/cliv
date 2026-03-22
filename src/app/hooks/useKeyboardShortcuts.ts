import { useEffect } from "react";
import { matchShortcut } from "@/lib/shortcuts";
import { useDocumentStore, useSelectionStore, useUIStore } from "@/stores";

/**
 * Hook: register global keyboard shortcuts and Ctrl+Wheel zoom.
 */
export function useKeyboardShortcuts(handleOpenFile: () => void) {
  const shortcuts = useUIStore((state) => state.shortcuts);
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
      if (matchShortcut(e, shortcuts.fontIncrease)) {
        e.preventDefault();
        adjustFontSize(1);
        return;
      }

      if (matchShortcut(e, shortcuts.fontDecrease)) {
        e.preventDefault();
        adjustFontSize(-1);
        return;
      }

      if (matchShortcut(e, shortcuts.fontReset)) {
        e.preventDefault();
        setFontSize(18);
        return;
      }

      if (matchShortcut(e, shortcuts.addAnnotation)) {
        e.preventDefault();
        if (useDocumentStore.getState().isReadOnly) {
          return;
        }
        const selection = useSelectionStore.getState().selection;
        if (selection) {
          useSelectionStore.getState().openPopup();
        }
        return;
      }

      if (matchShortcut(e, shortcuts.openFile)) {
        e.preventDefault();
        handleOpenFile();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [adjustFontSize, handleOpenFile, setFontSize, shortcuts]);
}
