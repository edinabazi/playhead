export const trackColumnIds = [
  "title",
  "artist",
  "album",
  "albumArtist",
  "genre",
  "disc",
  "trackNumber",
  "year",
  "composer",
  "bpm",
  "duration",
] as const;

export type TrackColumnId = (typeof trackColumnIds)[number];
export type TrackListSort = { column: TrackColumnId; direction: "asc" | "desc" };
export type TrackColumnWidths = Partial<Record<TrackColumnId, number>>;
export const minimumTrackColumnWidth = (id: TrackColumnId) => (id === "title" ? 180 : 60);
export const clampTrackColumnWidth = (id: TrackColumnId, width: number) =>
  Math.round(Math.min(1200, Math.max(minimumTrackColumnWidth(id), width)));
export type TrackListSettings = {
  columns: TrackColumnId[];
  sort: TrackListSort | null;
  widths?: TrackColumnWidths;
};

export const defaultTrackListSettings = (): TrackListSettings => ({
  columns: ["title", "duration"],
  sort: null,
});

export function normalizeTrackListSettings(value: unknown): TrackListSettings {
  if (!value || typeof value !== "object") return defaultTrackListSettings();
  const stored = value as Partial<TrackListSettings>;
  const columns = Array.isArray(stored.columns)
    ? trackColumnIds.filter((id) => id === "title" || stored.columns?.includes(id))
    : defaultTrackListSettings().columns;
  const sort = stored.sort;
  const widths: TrackColumnWidths = {};
  for (const id of trackColumnIds) {
    const width = stored.widths?.[id];
    if (typeof width === "number" && Number.isFinite(width))
      widths[id] = clampTrackColumnWidth(id, width);
  }
  return {
    columns,
    ...(Object.keys(widths).length ? { widths } : {}),
    sort:
      sort &&
      columns.includes(sort.column) &&
      (sort.direction === "asc" || sort.direction === "desc")
        ? { column: sort.column, direction: sort.direction }
        : null,
  };
}
