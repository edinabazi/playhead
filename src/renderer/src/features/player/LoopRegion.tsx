import { useEffect, useRef } from "react";
import { useIcons } from "@/lib/icon-context";
import { formatTime } from "@/lib/format";

export type PlaybackLoop = { start: number; end: number };

// Shorter loops are almost always an accidental Shift+click.
const minimumLoopSeconds = 0.25;

type Drag = { kind: "create"; anchor: number } | { kind: "start" | "end" } | null;

export function normalizeLoop(a: number, b: number, duration: number): PlaybackLoop | null {
  const start = Math.max(0, Math.min(a, b));
  const end = Math.min(duration, Math.max(a, b));
  return end - start >= minimumLoopSeconds ? { start, end } : null;
}

/**
 * Shift+drag on the waveform selects a section to loop. Plain drags keep seeking, so this
 * listens in the capture phase and only takes over when Shift is held or an edge is grabbed.
 */
export function LoopRegion({
  loop,
  duration,
  onChange,
  children,
}: {
  loop: PlaybackLoop | null;
  duration: number;
  onChange: (loop: PlaybackLoop | null) => void;
  children: React.ReactNode;
}) {
  const icons = useIcons();
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag>(null);
  const loopRef = useRef(loop);
  useEffect(() => {
    loopRef.current = loop;
  }, [loop]);

  const timeAt = (clientX: number) => {
    const rect = ref.current!.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) * duration;
  };

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const current = drag.current;
      if (!current || !ref.current || !duration) return;
      const time = timeAt(event.clientX);
      if (current.kind === "create") {
        const next = normalizeLoop(current.anchor, time, duration);
        if (next) onChange(next);
        return;
      }
      const existing = loopRef.current;
      if (!existing) return;
      const next =
        current.kind === "start"
          ? normalizeLoop(time, existing.end, duration)
          : normalizeLoop(existing.start, time, duration);
      if (next) onChange(next);
    };
    const onUp = () => {
      drag.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    // timeAt only reads refs and duration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration, onChange]);

  const startEdgeDrag = (kind: "start" | "end") => (event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    drag.current = { kind };
  };

  return (
    <div
      ref={ref}
      className="relative size-full"
      onPointerDownCapture={(event) => {
        if (!event.shiftKey || event.button !== 0 || !duration) return;
        // Keep wavesurfer from treating this as a seek.
        event.preventDefault();
        event.stopPropagation();
        drag.current = { kind: "create", anchor: timeAt(event.clientX) };
      }}
    >
      {children}
      {loop && duration > 0 && (
        <div
          className="pointer-events-none absolute inset-y-0 z-[2] border-x-2 border-primary/80 bg-primary/15"
          style={{
            left: `${(loop.start / duration) * 100}%`,
            width: `${((loop.end - loop.start) / duration) * 100}%`,
          }}
        >
          <span
            aria-label="Move loop start"
            className="no-drag cursor-ew-resize pointer-events-auto absolute inset-y-0 -left-[5px] w-2"
            onPointerDown={startEdgeDrag("start")}
          />
          <span
            aria-label="Move loop end"
            className="no-drag cursor-ew-resize pointer-events-auto absolute inset-y-0 -right-[5px] w-2"
            onPointerDown={startEdgeDrag("end")}
          />
          <button
            type="button"
            title={`Looping ${formatTime(loop.start)}–${formatTime(loop.end)} · Click to clear`}
            aria-label="Clear loop"
            className="no-drag pointer-events-auto absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-black/60 text-primary hover:bg-black/80"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onChange(null);
            }}
          >
            <icons.x size={10} strokeWidth={2.4} />
          </button>
        </div>
      )}
    </div>
  );
}
