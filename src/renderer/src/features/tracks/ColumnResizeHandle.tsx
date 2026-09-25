import { useEffect, useRef, useState } from "react";
import {
  clampTrackColumnWidth,
  minimumTrackColumnWidth,
  type TrackColumnId,
} from "../../../../shared/track-list";

export function ColumnResizeHandle({
  id,
  label,
  width,
  onPreview,
  onCommit,
}: {
  id: TrackColumnId;
  label: string;
  width: number;
  onPreview: (width: number | null) => void;
  onCommit: (width: number | undefined) => void;
}) {
  const handleRef = useRef<HTMLSpanElement>(null);
  const [measuredWidth, setMeasuredWidth] = useState(width);
  useEffect(() => {
    const cell = handleRef.current?.parentElement;
    if (!cell) return;
    const observer = new ResizeObserver(() =>
      setMeasuredWidth(Math.round(cell.getBoundingClientRect().width)),
    );
    observer.observe(cell);
    return () => observer.disconnect();
  }, []);
  const drag = useRef<{ x: number; width: number; current: number } | null>(null);
  const [resizing, setResizing] = useState(false);
  const cancel = () => {
    drag.current = null;
    setResizing(false);
    onPreview(null);
  };
  useEffect(() => {
    if (!resizing) return;
    const previousCursor = document.body.style.cursor;
    const previousSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousSelect;
    };
  }, [resizing]);

  return (
    <span
      ref={handleRef}
      role="separator"
      aria-label={`Resize ${label} column`}
      aria-orientation="vertical"
      aria-valuemin={minimumTrackColumnWidth(id)}
      aria-valuemax={1200}
      aria-valuenow={drag.current?.current ?? measuredWidth}
      tabIndex={0}
      title="Drag to resize · Double-click to reset"
      className={`group/resize absolute -right-[8px] top-0 z-10 flex h-7 w-2 cursor-col-resize touch-none items-center justify-center outline-none ${resizing ? "text-primary" : "text-white/25"}`}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.focus();
        event.currentTarget.setPointerCapture(event.pointerId);
        const measured = event.currentTarget.parentElement!.getBoundingClientRect().width;
        drag.current = { x: event.clientX, width: measured, current: measured };
        setResizing(true);
      }}
      onPointerMove={(event) => {
        if (!drag.current) return;
        const next = clampTrackColumnWidth(id, drag.current.width + event.clientX - drag.current.x);
        drag.current.current = next;
        onPreview(next);
      }}
      onPointerUp={(event) => {
        if (!drag.current) return;
        const current = drag.current;
        if (current.current !== current.width) onCommit(current.current);
        cancel();
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={cancel}
      onLostPointerCapture={() => {
        if (drag.current) cancel();
      }}
      onDoubleClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        cancel();
        onCommit(undefined);
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape") {
          event.preventDefault();
          cancel();
        }
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          const measured = event.currentTarget.parentElement!.getBoundingClientRect().width;
          onCommit(
            clampTrackColumnWidth(
              id,
              measured + (event.key === "ArrowLeft" ? -1 : 1) * (event.shiftKey ? 40 : 10),
            ),
          );
        }
        if (event.key === "Home" || event.key === "Enter") {
          event.preventDefault();
          cancel();
          onCommit(undefined);
        }
      }}
    >
      <span
        aria-hidden="true"
        className={`h-4 w-px rounded-full bg-current transition-opacity group-hover/resize:opacity-100 group-focus-visible/resize:opacity-100 ${resizing ? "opacity-100" : "opacity-0"}`}
      />
    </span>
  );
}
