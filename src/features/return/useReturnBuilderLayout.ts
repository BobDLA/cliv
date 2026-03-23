import {
  useCallback,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";

const MIN_PANEL_HEIGHT = 120;
const MAX_PANEL_HEIGHT = 600;
const MIN_SPLIT_RATIO = 0.2;
const MAX_SPLIT_RATIO = 0.8;

export function useReturnBuilderLayout() {
  const [panelHeight, setPanelHeight] = useState(220);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);

  const onVDragStart = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      dragRef.current = { startY: event.clientY, startH: panelHeight };

      const onMove = (moveEvent: MouseEvent) => {
        if (!dragRef.current) {
          return;
        }

        const delta = dragRef.current.startY - moveEvent.clientY;
        setPanelHeight(
          Math.max(
            MIN_PANEL_HEIGHT,
            Math.min(MAX_PANEL_HEIGHT, dragRef.current.startH + delta),
          ),
        );
      };

      const onUp = () => {
        dragRef.current = null;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [panelHeight],
  );

  const [splitRatio, setSplitRatio] = useState(0.5);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const hDragRef = useRef<{ startX: number; startRatio: number } | null>(null);

  const onHDragStart = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      hDragRef.current = { startX: event.clientX, startRatio: splitRatio };

      const onMove = (moveEvent: MouseEvent) => {
        if (!hDragRef.current || !splitContainerRef.current) {
          return;
        }

        const containerWidth = splitContainerRef.current.offsetWidth;
        if (containerWidth === 0) {
          return;
        }

        const deltaRatio =
          (moveEvent.clientX - hDragRef.current.startX) / containerWidth;
        setSplitRatio(
          Math.max(
            MIN_SPLIT_RATIO,
            Math.min(MAX_SPLIT_RATIO, hDragRef.current.startRatio + deltaRatio),
          ),
        );
      };

      const onUp = () => {
        hDragRef.current = null;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [splitRatio],
  );

  return {
    onHDragStart,
    onVDragStart,
    panelHeight,
    splitContainerRef,
    splitRatio,
  };
}
