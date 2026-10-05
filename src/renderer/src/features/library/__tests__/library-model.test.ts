import { describe, expect, it, vi } from "vitest";
import {
  createPlaylist,
  createTag,
  getLibraryAlbums,
  getLibraryArtists,
  getSourceTracks,
  getTrackAlbumId,
  getTrackArtistId,
  mergeScannedFolder,
  mergeScannedLibraryState,
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
  tags: [{ id: "tag-1", name: "Warmup", trackIds: ["track-1"], createdAt: "", updatedAt: "" }],
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
    expect(
      getSourceTracks({ ...baseState, selectedSource: { type: "tag", id: "tag-1" } }).map(
        (track) => track.id,
      ),
    ).toEqual(["track-1"]);
  });

  it("returns folder tracks for the selected subfolder", () => {
    const state: LibraryState = {
      ...baseState,
      folders: [{ ...baseState.folders[0], trackIds: ["track-1", "track-2", "track-3"] }],
      tracks: {
        ...baseState.tracks,
        "track-2": { ...baseState.tracks["track-2"], path: "/music/house/b.mp3" },
        "track-3": {
          ...baseState.tracks["track-2"],
          id: "track-3",
          path: "/music/house/deep/c.mp3",
        },
      },
    };
    const trackIds = (next: LibraryState) => getSourceTracks(next).map((track) => track.id);

    expect(trackIds(state)).toEqual(["track-1", "track-2", "track-3"]);
    expect(
      trackIds({
        ...state,
        selectedSource: { type: "folder", id: "folder-1", path: "/music/house" },
      }),
    ).toEqual(["track-2", "track-3"]);
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

  it("uses library grouping ids for track artist and album navigation", () => {
    expect(getTrackArtistId(baseState.tracks["track-1"])).toBe("album artist");
    expect(getTrackAlbumId(baseState.tracks["track-1"])).toBe("album artist::album");
    expect(
      getTrackAlbumId({
        ...baseState.tracks["track-1"],
        album: "",
        albumArtist: "",
      }),
    ).toBe("artist::unknown album");
  });

  it("removes deleted tracks and their collection and session references after a completed rescan", () => {
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

    const state = structuredClone(baseState);
    state.settings.session.activeTrackId = "track-1";
    state.settings.session.selectedTrackIds = ["track-1", "track-2"];
    state.settings.session.trackPositions = { "track-1": 30, "track-2": 40 };
    state.settings.session.queue.items = [
      { id: "q1", trackId: "track-1" },
      { id: "q2", trackId: "track-2" },
      { id: "remote", trackId: "soundcloud-1" },
    ];
    state.settings.session.queue.shuffledItems = state.settings.session.queue.items.slice();
    state.settings.session.queue.activeItemId = "q1";
    const next = mergeScannedFolder(state, scanned);
    expect(Object.keys(next.tracks)).toEqual(["track-2"]);
    expect(next.folders[0].trackIds).toEqual(["track-2"]);
    expect(next.playlists[0].trackIds).toEqual([]);
    expect(next.tags[0].trackIds).toEqual([]);
    expect(next.favoriteTrackIds).toEqual([]);
    expect(next.settings.session.activeTrackId).toBeNull();
    expect(next.settings.session.selectedTrackIds).toEqual(["track-2"]);
    expect(next.settings.session.trackPositions).toEqual({ "track-2": 40 });
    expect(next.settings.session.queue.activeItemId).toBeNull();
    expect(next.settings.session.queue.items.map((item) => item.id)).toEqual(["q2", "remote"]);
    expect(next.settings.session.queue.shuffledItems.map((item) => item.id)).toEqual([
      "q2",
      "remote",
    ]);
    expect(next.selectedSource).toEqual({ type: "folder", id: "folder-1" });
  });

  it("keeps the custom order and collection membership of surviving tracks", () => {
    const state = {
      ...baseState,
      folders: [{ ...baseState.folders[0], trackIds: ["track-2", "track-1"] }],
    };
    const next = mergeScannedFolder(state, {
      folder: { ...state.folders[0], trackIds: ["track-1", "track-2"] },
      tracks: Object.values(state.tracks),
    });
    expect(next.folders[0].trackIds).toEqual(["track-2", "track-1"]);
    expect(next.playlists).toEqual(baseState.playlists);
    expect(next.tags).toEqual(baseState.tags);
    expect(next.favoriteTrackIds).toEqual(baseState.favoriteTrackIds);
  });

  it("applies deletions to the latest state without undoing playlist edits or removing other roots", () => {
    const otherTrack = {
      ...baseState.tracks["track-1"],
      id: "other",
      folderId: "other-folder",
      path: "/other/song.mp3",
    };
    const latest: LibraryState = {
      ...baseState,
      selectedSource: { type: "playlist", id: "new" },
      folders: [
        ...baseState.folders,
        { id: "other-folder", path: "/other", name: "Other", trackIds: ["other"] },
      ],
      tracks: { ...baseState.tracks, other: otherTrack },
      playlists: [
        ...baseState.playlists,
        {
          id: "new",
          name: "New",
          trackIds: ["track-1", "track-2", "other"],
          createdAt: "",
          updatedAt: "",
        },
      ],
    };
    const scanned = mergeScannedFolder(baseState, {
      folder: { ...baseState.folders[0], trackIds: ["track-2"] },
      tracks: [baseState.tracks["track-2"]],
    });
    const next = mergeScannedLibraryState(latest, scanned, ["folder-1"]);
    expect(Object.keys(next.tracks)).toEqual(["track-2", "other"]);
    expect(next.playlists[1].trackIds).toEqual(["track-2", "other"]);
    expect(next.selectedSource).toEqual(latest.selectedSource);
    expect(next.folders[1]).toEqual(latest.folders[1]);
  });

  it("does not resurrect a root removed while its scan was running", () => {
    const next = mergeScannedLibraryState({ ...baseState, folders: [], tracks: {} }, baseState, [
      "folder-1",
    ]);
    expect(next.folders).toEqual([]);
    expect(next.tracks).toEqual({});
  });

  it("retains tracks that are still indexed by an overlapping root", () => {
    const state: LibraryState = {
      ...baseState,
      folders: [
        ...baseState.folders,
        { id: "other", name: "Parent", path: "/", trackIds: ["track-1"] },
      ],
    };
    const next = mergeScannedFolder(state, {
      folder: { ...baseState.folders[0], trackIds: [] },
      tracks: [],
    });
    expect(next.tracks["track-1"]).toEqual(baseState.tracks["track-1"]);
    expect(next.folders.find((folder) => folder.id === "folder-1")?.trackIds).toEqual([]);
    expect(next.playlists[0].trackIds).toEqual(["track-1"]);
  });

  it("preserves analyzed bpm when rescanned metadata has no bpm", () => {
    const scanned: ScannedFolder = {
      folder: { id: "folder-1", name: "Music", path: "/music", trackIds: ["track-1"] },
      tracks: [
        {
          ...baseState.tracks["track-1"],
          bpm: undefined,
          bpmSource: undefined,
        },
      ],
    };

    const next = mergeScannedFolder(
      {
        ...baseState,
        tracks: {
          ...baseState.tracks,
          "track-1": {
            ...baseState.tracks["track-1"],
            bpm: 128,
            bpmSource: "analysis",
          },
        },
      },
      scanned,
    );

    expect(next.tracks["track-1"].bpm).toBe(128);
    expect(next.tracks["track-1"].bpmSource).toBe("analysis");
  });

  it("prefers metadata bpm over preserved analyzed bpm", () => {
    const scanned: ScannedFolder = {
      folder: { id: "folder-1", name: "Music", path: "/music", trackIds: ["track-1"] },
      tracks: [
        {
          ...baseState.tracks["track-1"],
          bpm: 140,
          bpmSource: "metadata",
        },
      ],
    };

    const next = mergeScannedFolder(
      {
        ...baseState,
        tracks: {
          ...baseState.tracks,
          "track-1": {
            ...baseState.tracks["track-1"],
            bpm: 128,
            bpmSource: "analysis",
          },
        },
      },
      scanned,
    );

    expect(next.tracks["track-1"].bpm).toBe(140);
    expect(next.tracks["track-1"].bpmSource).toBe("metadata");
  });

  it("creates numbered playlists", () => {
    expect(createPlaylist([]).name).toBe("New Playlist");
    expect(createPlaylist([baseState.playlists[0]]).name).toBe("New Playlist 2");
  });

  it("creates numbered tags", () => {
    expect(createTag([]).name).toBe("New Tag");
    expect(createTag([baseState.tags[0]]).name).toBe("New Tag 2");
  });
});
