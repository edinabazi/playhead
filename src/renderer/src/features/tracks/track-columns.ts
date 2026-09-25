import type { LibraryTrack } from "../../../../shared/library";
import type {
  TrackColumnId,
  TrackColumnWidths,
  TrackListSort,
} from "../../../../shared/track-list";
import { formatTime } from "@/lib/format";

export const trackColumns: Record<
  TrackColumnId,
  { label: string; width: number; numeric?: boolean }
> = {
  title: { label: "Title", width: 180 },
  artist: { label: "Artist", width: 160 },
  album: { label: "Album", width: 160 },
  albumArtist: { label: "Album artist", width: 160 },
  genre: { label: "Genre", width: 90 },
  disc: { label: "Disc", width: 80 },
  trackNumber: { label: "Track no.", width: 90, numeric: true },
  year: { label: "Year", width: 80, numeric: true },
  composer: { label: "Composer", width: 160 },
  bpm: { label: "BPM", width: 80, numeric: true },
  duration: { label: "Time", width: 60, numeric: true },
};

function trackValue(track: LibraryTrack, column: TrackColumnId): string | number | undefined {
  if (column === "disc") return track.disc || track.diskNumber;
  return track[column];
}

export function formatTrackColumn(track: LibraryTrack, column: TrackColumnId): string {
  const value = trackValue(track, column);
  if (value == null || value === "" || (typeof value === "number" && !Number.isFinite(value)))
    return "—";
  return column === "duration" ? formatTime(track.duration) : String(value);
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

export function sortTrackList(tracks: LibraryTrack[], sort: TrackListSort | null): LibraryTrack[] {
  if (!sort) return tracks;
  return tracks.slice().sort((a, b) => {
    const left = trackValue(a, sort.column);
    const right = trackValue(b, sort.column);
    const leftMissing =
      left == null || left === "" || (typeof left === "number" && !Number.isFinite(left));
    const rightMissing =
      right == null || right === "" || (typeof right === "number" && !Number.isFinite(right));
    // Missing metadata stays at the end in both directions. Ties retain the source order.
    if (leftMissing || rightMissing) return Number(leftMissing) - Number(rightMissing);
    const comparison =
      typeof left === "number" && typeof right === "number"
        ? left - right
        : collator.compare(String(left), String(right));
    return sort.direction === "asc" ? comparison : -comparison;
  });
}

export function getTrackListLayout(columns: TrackColumnId[], widths: TrackColumnWidths = {}) {
  return {
    gridTemplateColumns: `20px ${columns.map((id) => (id === "title" && widths.title === undefined ? "minmax(180px, 1fr)" : `${widths[id] ?? trackColumns[id].width}px`)).join(" ")} ${widths.title === undefined ? "64px" : "minmax(64px, 1fr)"}`,
    minWidth:
      20 +
      64 +
      28 +
      columns.reduce((sum, id) => sum + (widths[id] ?? trackColumns[id].width), 0) +
      (columns.length + 1) * 8,
  };
}
