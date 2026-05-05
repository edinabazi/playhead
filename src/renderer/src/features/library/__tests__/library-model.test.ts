import { describe, expect, it, vi } from "vitest";
import { createPlaylist, getSourceTracks, mergeScannedFolder } from "../library-model";
import type { LibraryState, ScannedFolder } from "../../../../../shared/library";

vi.stubGlobal("crypto", { randomUUID: () => "test-id" });

const baseState: LibraryState = {
  folders: [{ id: "folder-1", name: "Music", path: "/music", trackIds: ["track-1"] }],
  tracks: {
    "track-1": {
      id: "track-1",
      path: "/music/a.mp3",
      fileName: "a.mp3",
      title: "A",
      artist: "Artist",
      duration: 1,
      folderId: "folder-1",
    },
  },
  playlists: [
    { id: "playlist-1", name: "Set", trackIds: ["track-1"], createdAt: "", updatedAt: "" },
  ],
  favoriteTrackIds: ["track-1"],
  selectedSource: { type: "folder", id: "folder-1" },
};

describe("library model", () => {
  it("returns tracks for the selected source", () => {
    expect(getSourceTracks(baseState).map((track) => track.id)).toEqual(["track-1"]);
    expect(
      getSourceTracks({ ...baseState, selectedSource: { type: "loved" } }).map((track) => track.id),
    ).toEqual(["track-1"]);
  });

  it("merges a scanned folder and removes stale playlist references", () => {
    const scanned: ScannedFolder = {
      folder: { id: "folder-1", name: "Music", path: "/music", trackIds: ["track-2"] },
      tracks: [
        {
          id: "track-2",
          path: "/music/b.mp3",
          fileName: "b.mp3",
          title: "B",
          artist: "Artist",
          duration: 2,
          folderId: "folder-1",
        },
      ],
    };

    const next = mergeScannedFolder(baseState, scanned);
    expect(Object.keys(next.tracks)).toEqual(["track-2"]);
    expect(next.playlists[0].trackIds).toEqual([]);
    expect(next.selectedSource).toEqual({ type: "folder", id: "folder-1" });
  });

  it("creates numbered playlists", () => {
    expect(createPlaylist([]).name).toBe("New Playlist");
    expect(createPlaylist([baseState.playlists[0]]).name).toBe("New Playlist 2");
  });
});
