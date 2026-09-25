import { describe, expect, it } from "vitest";
import type { LibraryTrack } from "../../../../../shared/library";
import { normalizeTrackListSettings } from "../../../../../shared/track-list";
import { formatTrackColumn, sortTrackList } from "../track-columns";

function track(id: string, metadata: Partial<LibraryTrack> = {}): LibraryTrack {
  return {
    id,
    path: id,
    fileName: id,
    title: id,
    artist: "Artist",
    duration: 120,
    folderId: "folder",
    ...metadata,
  };
}
const ids = (tracks: LibraryTrack[]) => tracks.map((item) => item.id);

describe("track list sorting", () => {
  it("sorts text naturally, keeps ties in source order and missing values last", () => {
    const tracks = [
      track("missing"),
      track("ten", { disc: "10" }),
      track("two", { disc: "2" }),
      track("calm", { disc: "Calm" }),
      track("same", { disc: "calm" }),
    ];
    expect(ids(sortTrackList(tracks, { column: "disc", direction: "asc" }))).toEqual([
      "two",
      "ten",
      "calm",
      "same",
      "missing",
    ]);
    expect(ids(sortTrackList(tracks, { column: "disc", direction: "desc" }))).toEqual([
      "calm",
      "same",
      "ten",
      "two",
      "missing",
    ]);
    expect(ids(tracks)).toEqual(["missing", "ten", "two", "calm", "same"]);
    expect(sortTrackList(tracks, null)).toBe(tracks);
  });

  it("sorts numeric metadata as numbers and supports old numeric disc metadata", () => {
    const tracks = [
      track("ten", { trackNumber: 10, diskNumber: 10 }),
      track("two", { trackNumber: 2, diskNumber: 2 }),
      track("missing"),
    ];
    expect(ids(sortTrackList(tracks, { column: "trackNumber", direction: "asc" }))).toEqual([
      "two",
      "ten",
      "missing",
    ]);
    expect(ids(sortTrackList(tracks, { column: "disc", direction: "asc" }))).toEqual([
      "two",
      "ten",
      "missing",
    ]);
    expect(formatTrackColumn(tracks[0], "disc")).toBe("10");
    expect(formatTrackColumn(tracks[2], "genre")).toBe("—");
  });

  it("sorts genre without case sensitivity and duration without formatting first", () => {
    const tracks = [
      track("a", { genre: "House", duration: 65 }),
      track("b", { genre: "ambient", duration: 600 }),
    ];
    expect(ids(sortTrackList(tracks, { column: "genre", direction: "asc" }))).toEqual(["b", "a"]);
    expect(ids(sortTrackList(tracks, { column: "duration", direction: "asc" }))).toEqual([
      "a",
      "b",
    ]);
  });
});

it("normalizes old, malformed and hidden-column preferences", () => {
  expect(normalizeTrackListSettings(undefined)).toEqual({
    columns: ["title", "duration"],
    sort: null,
  });
  expect(
    normalizeTrackListSettings({
      columns: ["genre", "genre", "unknown"],
      sort: { column: "disc", direction: "asc" },
    }),
  ).toEqual({ columns: ["title", "genre"], sort: null });
  expect(
    normalizeTrackListSettings({ columns: [], sort: { column: "title", direction: "bad" } }),
  ).toEqual({ columns: ["title"], sort: null });
});
