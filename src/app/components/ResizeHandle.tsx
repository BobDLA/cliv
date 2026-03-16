/**
 * Vertical resize handle for column borders.
 * Renders a subtle 1px line that thickens on hover.
 */
interface ResizeHandleProps {
  onDragStart: (e: React.MouseEvent) => void;
}

export function ResizeHandle({ onDragStart }: ResizeHandleProps) {
  return (
    <div
      onMouseDown={onDragStart}
      style={{
        width: "6px",
        cursor: "col-resize",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: "1px",
          height: "100%",
          backgroundColor: "var(--color-border-subtle)",
          transition: "width 0.1s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.width = "2px")}
        onMouseLeave={(e) => (e.currentTarget.style.width = "1px")}
      />
    </div>
  );
}
