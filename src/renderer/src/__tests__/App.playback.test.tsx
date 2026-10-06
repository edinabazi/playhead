import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  emptyLibraryState,
  libraryTrackMetadataVersion,
  type LibraryState,
  type PlayheadApi,
} from "../../../shared/library";

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (...args: any[]) => void>(),
  ended: false,
  time: 0,
  load: vi.fn(),
  pause: vi.fn(),
  play: vi.fn(),
  state: null as unknown as LibraryState,
  folderChanged: (() => {}) as (id: string) => void,
}));
vi.mock("wavesurfer.js", () => ({
  default: {
    create: () => {
      const media = document.createElement("audio");
      Object.defineProperty(media, "ended", { get: () => mocks.ended });
      return {
        on: (event: string, callback: (...args: any[]) => void) => {
          mocks.handlers.set(event, callback);
          return () => mocks.handlers.delete(event);
        },
        getMediaElement: () => media,
        getRenderer: () => ({
          renderProgress: () => {},
          getWrapper: () => document.createElement("div"),
        }),
        getDuration: () => 120,
        getCurrentTime: () => mocks.time,
        pause: mocks.pause,
        play: mocks.play,
        setTime: (time: number) => {
          mocks.time = time;
          mocks.ended = false;
        },
        setVolume: () => {},
        setOptions: () => {},
        stop: () => {},
        empty: () => {},
        destroy: () => {},
        exportPeaks: () => [[0, 1]],
      };
    },
  },
}));
vi.mock("../features/player/local-playback", async (original) => ({
  ...(await original<typeof import("../features/player/local-playback")>()),
  loadLocalPlayback: mocks.load,
}));
import { App } from "../App";

beforeEach(() => {
  mocks.handlers.clear();
  mocks.ended = false;
  mocks.time = 0;
  mocks.load.mockReset().mockImplementation(async () => {
    mocks.ended = false;
    return { copied: false };
  });
  mocks.play.mockReset().mockResolvedValue(undefined);
  mocks.pause.mockReset();
  mocks.state = emptyLibraryState();
  mocks.state.settings.library.mode = "folder";
  mocks.state.settings.playback.restoreLastSession = false;
  const tracks = Array.from({ length: 3 }, (_, index) => ({
    id: `track-${index + 1}`,
    path: `/music/${index + 1}.mp3`,
    fileName: `${index + 1}.mp3`,
    title: `Song ${index + 1}`,
    artist: "Artist",
    duration: 120,
    bpm: 120,
    folderId: "folder",
    metadataVersion: libraryTrackMetadataVersion,
  }));
  mocks.state.tracks = Object.fromEntries(tracks.map((track) => [track.id, track]));
  mocks.state.folders = [
    {
      id: "folder",
      path: "/music",
      name: "Music",
      trackIds: tracks.map((track) => track.id),
      metadataVersion: libraryTrackMetadataVersion,
    },
  ];
  mocks.state.selectedSource = { type: "folder", id: "folder" };
  mocks.state.playlists = [
    { id: "other", name: "Other Set", trackIds: ["track-3"], createdAt: "", updatedAt: "" },
  ];
  const api = {
    getLibraryState: async () => mocks.state,
    saveLibraryState: async (state: LibraryState) => {
      mocks.state = state;
      return state;
    },
    saveLibrarySessionSettings: async (session: LibraryState["settings"]["session"]) => {
      mocks.state = { ...mocks.state, settings: { ...mocks.state.settings, session } };
      return mocks.state;
    },
    saveLibrarySelectedSource: async () => mocks.state,
    watchLibraryFolders: async () => {},
    getAppVersion: async () => "test",
    getUpdateState: async () => ({ status: "idle" }),
    getLastfmState: async () => ({
      configured: false,
      connected: false,
      pendingAuth: false,
      queueSize: 0,
    }),
    getSoundCloudState: async () => ({ configured: false, connected: false, pendingAuth: false }),
    isDiscordConfigured: async () => false,
    setDiscordEnabled: async () => undefined,
    updateDiscordPresence: async () => undefined,
    onMediaCommand: () => () => {},
    onUpdateStateChanged: () => () => {},
    onSoundCloudStateChanged: () => () => {},
    onFolderChanged: (callback: (id: string) => void) => {
      mocks.folderChanged = callback;
      return () => {};
    },
    getAudioFileUrl: async () => "file:///song.mp3",
    getWaveformCache: async () => null,
    saveWaveformCache: async () => {},
    trackEvent: () => {},
    updateLastfmNowPlaying: async () => ({
      configured: false,
      connected: false,
      pendingAuth: false,
      queueSize: 0,
    }),
  };
  window.playhead = api as unknown as PlayheadApi;
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(280);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("__APP_VERSION__", "test");
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function start() {
  const view = render(<App />);
  await waitFor(() => expect(view.getByText("Song 1")).toBeTruthy());
  fireEvent.doubleClick(view.getByText("Song 1"));
  await waitFor(() => expect(mocks.load).toHaveBeenCalledOnce());
  await act(async () => {});
  return view;
}

it("advances exactly one queue item even when completion is repeated during a delayed next load", async () => {
  await start();
  let release!: () => void;
  mocks.load.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = () => {
          mocks.ended = false;
          resolve({ copied: false });
        };
      }),
  );
  mocks.ended = true;
  act(() => mocks.handlers.get("finish")!());
  await waitFor(() => expect(mocks.load).toHaveBeenCalledTimes(2));
  expect(mocks.state.settings.session.activeTrackId).toBe("track-2");
  act(() => mocks.handlers.get("finish")!());
  await act(async () => {});
  expect(mocks.state.settings.session.activeTrackId).toBe("track-2");
  expect(mocks.load).toHaveBeenCalledTimes(2);
  await act(async () => release());
  // A stale completion after the next source is playing must also be ignored.
  act(() => mocks.handlers.get("finish")!());
  expect(mocks.load).toHaveBeenCalledTimes(2);
  mocks.ended = true;
  act(() => mocks.handlers.get("finish")!());
  await waitFor(() => expect(mocks.load).toHaveBeenCalledTimes(3));
  expect(mocks.state.settings.session.activeTrackId).toBe("track-3");
  await act(async () => {});
  mocks.ended = true;
  act(() => mocks.handlers.get("finish")!());
  expect(mocks.load).toHaveBeenCalledTimes(3);
});

it("reveals the playing track from its source and selects and focuses it after browsing elsewhere", async () => {
  const view = await start();
  fireEvent.click(view.getByRole("button", { name: "Other Set" }));
  await waitFor(() => expect(view.queryByRole("table", { name: "Tracks" })).toBeTruthy());
  fireEvent.click(view.getByRole("button", { name: "Jump to currently playing song" }));
  await waitFor(() => expect(view.getByRole("rowgroup")).toBe(document.activeElement));
  expect(
    view
      .getAllByText("Song 1")
      .find((element) => element.closest('[role="row"]'))
      ?.closest('[role="row"]')
      ?.getAttribute("aria-selected"),
  ).toBe("true");
  fireEvent.keyDown(window, { key: "ArrowDown", code: "ArrowDown" });
  expect(view.getByText("Song 2").closest('[role="row"]')?.getAttribute("aria-selected")).toBe(
    "true",
  );
});

it("removes a deleted file after a watcher rescan and clears its active playback", async () => {
  const view = await start();
  const remaining = Object.values(mocks.state.tracks).filter((track) => track.id !== "track-1");
  window.playhead.scanFolder = async () => ({
    folder: { ...mocks.state.folders[0], trackIds: remaining.map((track) => track.id) },
    tracks: remaining,
  });
  act(() => mocks.folderChanged("folder"));
  await waitFor(() => expect(mocks.state.tracks["track-1"]).toBeUndefined());
  await waitFor(() => expect(view.queryByText("Song 1")).toBeNull());
  expect(mocks.state.settings.session.activeTrackId).toBeNull();
});
