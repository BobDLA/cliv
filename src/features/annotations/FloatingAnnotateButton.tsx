import { memo, useEffect, useRef, useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { useSelectionStore } from "@/stores";

/**
 * FloatingAnnotateButton — appears near the END of selected text on mouseup.
 * Only shows after a valid text selection is completed (mouseup with non-empty selection).
 */
export const FloatingAnnotateButton = memo(function FloatingAnnotateButton() {
  const { selection, showPopup, openPopup } = useSelectionStore();
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<number>(0);

  // Show button only on valid mouseup with text selected
  useEffect(() => {
    const handleMouseUp = () => {
      // Only show if there's an active selection and popup not open
      clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        const sel = window.getSelection();
        const hasSelection = sel && !sel.isCollapsed && sel.toString().trim().length >= 2;
        const popupOpen = useSelectionStore.getState().showPopup;
        setVisible(!!hasSelection && !popupOpen);
      }, 50); // Small delay to let SelectionCatcher set the selection first
    };

    const handleMouseDown = () => {
      // Hide on new mousedown (user is starting a new interaction)
      setVisible(false);
    };

    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mousedown", handleMouseDown);
      clearTimeout(timerRef.current);
    };
  }, []);

  // Also hide when popup opens or selection clears
  useEffect(() => {
    if (showPopup || !selection) setVisible(false);
  }, [showPopup, selection]);

  if (!visible || !selection || showPopup) return null;

  return (
    <div
      className="absolute z-40"
      style={{
        top: `${selection.rect.bottom + 6}px`,
        left: `${selection.rect.left + selection.rect.width / 2}px`,
        transform: "translateX(-50%)",
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setVisible(false);
          openPopup();
        }}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "5px 12px",
          borderRadius: "var(--radius-md)",
          backgroundColor: "var(--color-accent)",
          color: "#fff",
          fontSize: "12px",
          fontWeight: 500,
          fontFamily: "var(--font-sans)",
          border: "none",
          cursor: "pointer",
          boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
          transition: "all 0.15s",
        }}
      >
        <MessageSquarePlus style={{ width: "14px", height: "14px" }} />
        <span>添加批注</span>
        <kbd
          style={{
            marginLeft: "4px",
            padding: "1px 4px",
            borderRadius: "3px",
            backgroundColor: "rgba(255,255,255,0.2)",
            fontSize: "10px",
            fontWeight: 400,
            fontFamily: "var(--font-sans)",
          }}
        >
          Ctrl+Alt+M
        </kbd>
      </button>
    </div>
  );
});
