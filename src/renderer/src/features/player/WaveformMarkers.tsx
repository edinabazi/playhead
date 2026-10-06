import { useState } from "react";
import { formatTime } from "@/lib/format";
import { useIcons } from "@/lib/icon-context";
import type { TrackMarker } from "../../../../shared/library";

/** User markers drawn as thin flags along the top of the waveform. */
export function WaveformMarkers({
  markers,
  duration,
  onSeek,
  onRename,
  onDelete,
}: {
  markers: TrackMarker[];
  duration: number;
  onSeek: (time: number) => void;
  onRename: (marker: TrackMarker) => void;
  onDelete: (marker: TrackMarker) => void;
}) {
  const icons = useIcons();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  if (!duration) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[3]">
      {markers.map((marker) => {
        const position = Math.min(1, marker.time / duration);
        const hovered = hoveredId === marker.id;
        return (
          <div
            key={marker.id}
            className="absolute inset-y-0"
            style={{ left: `${position * 100}%` }}
            onMouseEnter={() => setHoveredId(marker.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <span className="absolute inset-y-0 -left-px w-px bg-primary/70" />
            <button
              type="button"
              aria-label={`${marker.label} at ${formatTime(marker.time)}`}
              title="Click to jump · Double-click to rename"
              className="no-drag pointer-events-auto absolute -left-[5px] top-0 h-3 w-[10px] rounded-b-[3px] bg-primary"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onSeek(marker.time);
              }}
              onDoubleClick={(event) => {
                event.stopPropagation();
                onRename(marker);
              }}
            />
            {hovered && (
              <div
                className={`pointer-events-auto absolute top-0 flex items-center gap-1.5 whitespace-nowrap rounded-[8px] border border-white/10 bg-[rgba(10,10,10,0.9)] py-1 pl-2 pr-1 text-[11px] leading-none ${
                  position > 0.75 ? "right-2" : "left-2"
                }`}
              >
                <span className="font-semibold text-foreground">{marker.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {formatTime(marker.time)}
                </span>
                <button
                  type="button"
                  aria-label={`Delete ${marker.label}`}
                  className="no-drag grid size-4 place-items-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-foreground"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(marker);
                  }}
                >
                  <icons.x size={10} strokeWidth={2.2} />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
