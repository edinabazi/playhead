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
export type TrackListSettings = { columns: TrackColumnId[]; sort: TrackListSort | null };

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
  return {
    columns,
    sort:
      sort &&
      columns.includes(sort.column) &&
      (sort.direction === "asc" || sort.direction === "desc")
        ? { column: sort.column, direction: sort.direction }
        : null,
  };
}
