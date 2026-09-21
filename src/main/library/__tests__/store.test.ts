import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  defaultAppSettings,
  defaultPlaybackSettings,
  emptyLibraryState,
  type LibraryState,
} from "../../../shared/library";

const storeTestState = vi.hoisted(() => ({ userDataDir: "" }));

vi.mock("../../electron", () => ({
  electron: {
    app: {
      getPath: () => storeTestState.userDataDir,
    },
  },
}));

import {
  normalizeSettings,
  readLibraryState,
  resetLibraryStoreCache,
  writeLibrarySelectedSource,
  writeLibrarySessionSettings,
  writeLibraryState,
  writeLibraryTrackAnalysis,
} from "../store";

beforeEach(async () => {
  resetLibraryStoreCache();
  storeTestState.userDataDir = await mkdtemp(join(tmpdir(), "playhead-store-"));
});

afterEach(async () => {
  if (storeTestState.userDataDir) {
    await rm(storeTestState.userDataDir, { recursive: true, force: true });
  }
});

function namedState(name: string): LibraryState {
  return {
    ...emptyLibraryState(),
    playlists: [
      {
        id: "playlist-1",
        name,
        trackIds: [],
        createdAt: "",
        updatedAt: "",
      },
    ],
  };
}

describe("library store settings", () => {
  it("defaults to a flat sidebar and preserves an explicit subfolder preference", async () => {
    expect((await readLibraryState()).settings.library.showSubfolders).toBe(false);
    const state = namedState("Subfolders");
    state.settings.library.showSubfolders = true;
    await writeLibraryState(state);
    resetLibraryStoreCache();
    expect((await readLibraryState()).settings.library.showSubfolders).toBe(true);
  });

  it("restores the watched folder when a saved subfolder is hidden", async () => {
    const state = namedState("Flat");
    state.selectedSource = { type: "folder", id: "music", path: "/music/house" };
    await writeLibraryState(state);
    resetLibraryStoreCache();
    expect((await readLibraryState()).selectedSource).toEqual({ type: "folder", id: "music" });
  });

  it("provides playback defaults", () => {
    expect(defaultPlaybackSettings()).toEqual({
      seekStepSeconds: 5,
      volumeStepPercent: 5,
      normalizeVolume: false,
      rememberTrackPositions: true,
      restoreLastSession: true,
      skipUnavailableTracks: true,
    });
  });

  it("normalizes missing settings", () => {
    expect(normalizeSettings(undefined)).toEqual(defaultAppSettings());
  });

  it("normalizes missing session playback controls", () => {
    const legacySettings = {
      session: {
        activeTrackId: "track-1",
        selectedTrackIds: ["track-1"],
        trackPositions: {},
      },
    } as unknown as Parameters<typeof normalizeSettings>[0];

    expect(normalizeSettings(legacySettings).session).toEqual({
      activeTrackId: "track-1",
      selectedTrackIds: ["track-1"],
      trackPositions: {},
      shuffleEnabled: false,
      repeatMode: "off",
      sidebarGroupOrder: ["library", "playlists", "tags", "soundcloud"],
      expandedFolderPaths: [],
      queue: {
        items: [],
        shuffledItems: [],
        activeItemId: null,
        source: null,
        panelOpen: false,
      },
    });
  });

  it("normalizes missing queue fields", () => {
    const settings = normalizeSettings({
      session: {
        activeTrackId: "track-1",
        selectedTrackIds: ["track-1"],
        trackPositions: {},
        shuffleEnabled: true,
        repeatMode: "all",
        queue: {
          items: [{ id: "queue-1", trackId: "track-1" }],
        },
      },
    } as unknown as Parameters<typeof normalizeSettings>[0]);

    expect(settings.session.queue).toEqual({
      items: [{ id: "queue-1", trackId: "track-1" }],
      shuffledItems: [],
      activeItemId: null,
      source: null,
      panelOpen: false,
    });
  });

  it("normalizes missing Last.fm settings", () => {
    const settings = normalizeSettings({
      playback: {
        seekStepSeconds: 10,
      },
    } as unknown as Parameters<typeof normalizeSettings>[0]);

    expect(settings.lastfm).toEqual({
      scrobblingEnabled: true,
      loveSyncEnabled: false,
    });
  });

  it("normalizes legacy flat library settings", () => {
    const settings = normalizeSettings({
      enabledAudioExtensions: [".mp3"],
      watchFolders: false,
      rescanOnLaunch: true,
    });

    expect(settings.library).toEqual({
      mode: "library",
      enabledAudioExtensions: [".mp3"],
      watchFolders: false,
      rescanOnLaunch: true,
      showSubfolders: false,
    });
    expect(settings.playback).toEqual(defaultPlaybackSettings());
  });

  it("writes library.json atomically and keeps a valid backup", async () => {
    await writeLibraryState(namedState("Before"));
    await writeLibraryState(namedState("After"));

    const current = JSON.parse(
      await readFile(join(storeTestState.userDataDir, "library.json"), "utf8"),
    ) as LibraryState;
    const backup = JSON.parse(
      await readFile(join(storeTestState.userDataDir, "library.json.bak"), "utf8"),
    ) as LibraryState;

    expect(current.playlists[0].name).toBe("After");
    expect(backup.playlists[0].name).toBe("Before");
  });

  it("falls back to the backup when the primary library is unreadable", async () => {
    await writeLibraryState(namedState("Backup"));
    await writeLibraryState(namedState("Primary"));
    await writeFile(join(storeTestState.userDataDir, "library.json"), "{bad json", "utf8");
    resetLibraryStoreCache();

    const state = await readLibraryState();

    expect(state.playlists[0].name).toBe("Backup");
  });

  it("merges session saves into the latest library data", async () => {
    const latest = {
      ...namedState("Set"),
      playlists: [
        {
          id: "playlist-1",
          name: "Set",
          trackIds: ["track-1", "track-2"],
          createdAt: "",
          updatedAt: "",
        },
      ],
    };
    await writeLibraryState(latest);

    const session = { ...defaultAppSettings().session, activeTrackId: "track-1" };
    const saved = await writeLibrarySessionSettings(session);

    expect(saved.settings.session.activeTrackId).toBe("track-1");
    expect(saved.playlists[0].trackIds).toEqual(["track-1", "track-2"]);
  });

  it("persists volatile session state without rewriting the library index", async () => {
    await writeLibraryState(namedState("Set"));
    const libraryBefore = await readFile(join(storeTestState.userDataDir, "library.json"), "utf8");

    const session = { ...defaultAppSettings().session, activeTrackId: "track-1" };
    await writeLibrarySessionSettings(session);
    const libraryAfter = await readFile(join(storeTestState.userDataDir, "library.json"), "utf8");
    resetLibraryStoreCache();
    const restored = await readLibraryState();

    expect(libraryAfter).toBe(libraryBefore);
    expect(restored.settings.session.activeTrackId).toBe("track-1");
  });

  it("merges analyzed bpm saves into the latest library data", async () => {
    await writeLibraryState({
      ...emptyLibraryState(),
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
        {
          id: "playlist-1",
          name: "Set",
          trackIds: ["track-1", "track-2"],
          createdAt: "",
          updatedAt: "",
        },
      ],
    });

    const saved = await writeLibraryTrackAnalysis("track-1", 128);

    expect(saved.tracks["track-1"].bpm).toBe(128);
    expect(saved.tracks["track-1"].bpmSource).toBe("analysis");
    expect(saved.playlists[0].trackIds).toEqual(["track-1", "track-2"]);
  });

  it("restores analyzed BPM updates from the append-only journal", async () => {
    await writeLibraryState({
      ...emptyLibraryState(),
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
    });

    await writeLibraryTrackAnalysis("track-1", 132);
    resetLibraryStoreCache();
    const restored = await readLibraryState();

    expect(restored.tracks["track-1"].bpm).toBe(132);
    expect(restored.tracks["track-1"].bpmSource).toBe("analysis");
  });

  it("serializes concurrent runtime and analysis updates without losing either", async () => {
    await writeLibraryState({
      ...emptyLibraryState(),
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
    });
    const session = { ...defaultAppSettings().session, activeTrackId: "track-1" };

    await Promise.all([
      writeLibrarySessionSettings(session),
      writeLibraryTrackAnalysis("track-1", 140),
    ]);
    resetLibraryStoreCache();
    const restored = await readLibraryState();

    expect(restored.settings.session.activeTrackId).toBe("track-1");
    expect(restored.tracks["track-1"].bpm).toBe(140);
  });

  it("merges selected source saves into the latest library data", async () => {
    await writeLibraryState({
      ...namedState("Set"),
      playlists: [
        {
          id: "playlist-1",
          name: "Set",
          trackIds: ["track-1"],
          createdAt: "",
          updatedAt: "",
        },
      ],
    });

    const saved = await writeLibrarySelectedSource({ type: "playlist", id: "playlist-1" });

    expect(saved.selectedSource).toEqual({ type: "playlist", id: "playlist-1" });
    expect(saved.playlists[0].trackIds).toEqual(["track-1"]);
  });
});
