import { describe, expect, it, vi } from "vitest";
import {
  createPlaylist,
  getLibraryAlbums,
  getLibraryArtists,
  getSourceTracks,
  mergeScannedFolder,
} from "../library-model";
import {
  defaultAppSettings,
  type LibraryState,
  type ScannedFolder,
} from "../../../../../shared/library";

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
      album: "Album",
      albumArtist: "Album Artist",
      trackNumber: 2,
      diskNumber: 1,
      duration: 1,
      artwork: { mimeType: "image/png", src: "file:///cover-a.png" },
      folderId: "folder-1",
    },
    "track-2": {
      id: "track-2",
      path: "/music/b.mp3",
      fileName: "b.mp3",
      title: "B",
      artist: "Artist",
      album: "Album",
      albumArtist: "Album Artist",
      trackNumber: 1,
      diskNumber: 1,
      duration: 2,
      artwork: { mimeType: "image/png", src: "file:///cover-b.png" },
      folderId: "folder-1",
    },
  },
  playlists: [
    { id: "playlist-1", name: "Set", trackIds: ["track-1"], createdAt: "", updatedAt: "" },
  ],
  favoriteTrackIds: ["track-1"],
  selectedSource: { type: "folder", id: "folder-1" },
  settings: defaultAppSettings(),
};

describe("library model", () => {
  it("returns tracks for the selected source", () => {
    expect(getSourceTracks(baseState).map((track) => track.id)).toEqual(["track-1"]);
    expect(
      getSourceTracks({ ...baseState, selectedSource: { type: "loved" } }).map((track) => track.id),
    ).toEqual(["track-1"]);
    expect(
      getSourceTracks({ ...baseState, selectedSource: { type: "library-tracks" } }).map(
        (track) => track.id,
      ),
    ).toEqual(["track-1", "track-2"]);
    expect(
      getSourceTracks({
        ...baseState,
        selectedSource: { type: "library-artist", id: "album artist" },
      }).map((track) => track.id),
    ).toEqual(["track-1", "track-2"]);
    expect(
      getSourceTracks({
        ...baseState,
        selectedSource: { type: "library-album", id: "album artist::album" },
      }).map((track) => track.id),
    ).toEqual(["track-2", "track-1"]);
  });

  it("builds library artists and albums", () => {
    expect(getLibraryArtists(baseState)).toEqual([
      {
        id: "album artist",
        name: "Album Artist",
        artworkSet: [
          { mimeType: "image/png", src: "file:///cover-a.png" },
          { mimeType: "image/png", src: "file:///cover-b.png" },
        ],
        trackIds: ["track-1", "track-2"],
      },
    ]);
    expect(
      getLibraryAlbums(baseState).map((album) => ({
        id: album.id,
        title: album.title,
        artist: album.artist,
        trackIds: album.trackIds,
      })),
    ).toEqual([
      {
        id: "album artist::album",
        title: "Album",
        artist: "Album Artist",
        trackIds: ["track-1", "track-2"],
      },
    ]);
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
