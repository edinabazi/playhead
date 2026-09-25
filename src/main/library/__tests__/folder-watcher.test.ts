import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LibraryFolder } from "../../../shared/library";

const watcherMocks = vi.hoisted(() => {
  const close = vi.fn(async () => undefined);
  const on = vi.fn().mockReturnThis();
  return {
    close,
    on,
    watch: vi.fn(() => ({ close, on })),
    nativeWatch: vi.fn<
      (
        path: string,
        options: unknown,
        listener: (event: string, name: string) => void,
      ) => { close: typeof close; on: typeof on }
    >(() => ({ close, on })),
    platform: vi.fn(() => "linux"),
    send: vi.fn(),
  };
});

vi.mock("node:fs", async (original) => {
  const actual = await original<typeof import("node:fs")>();
  return {
    ...actual,
    default: { ...actual, watch: watcherMocks.nativeWatch },
    watch: watcherMocks.nativeWatch,
  };
});
vi.mock("node:os", async (original) => {
  const actual = await original<typeof import("node:os")>();
  return {
    ...actual,
    default: { ...actual, platform: watcherMocks.platform },
    platform: watcherMocks.platform,
  };
});
vi.mock("chokidar", () => ({ default: { watch: watcherMocks.watch } }));
vi.mock("../../electron", () => ({
  electron: {
    BrowserWindow: { getAllWindows: () => [{ webContents: { send: watcherMocks.send } }] },
  },
}));

import { closeFolderWatcher, watchLibraryFolders } from "../folder-watcher";

const folder: LibraryFolder = {
  id: "folder-1",
  name: "Music",
  path: "/music",
  trackIds: [],
};

beforeEach(() => {
  watcherMocks.close.mockClear();
  watcherMocks.on.mockClear();
  watcherMocks.watch.mockClear();
  watcherMocks.nativeWatch.mockClear();
  watcherMocks.platform.mockReturnValue("linux");
  watcherMocks.send.mockClear();
});

afterEach(async () => {
  await closeFolderWatcher();
  vi.useRealTimers();
});

describe("folder watcher", () => {
  it("keeps the existing watcher when folder configuration is unchanged", async () => {
    await watchLibraryFolders([folder], [".mp3", ".flac"]);
    await watchLibraryFolders([{ ...folder, trackIds: ["track-1"] }], [".flac", ".mp3"]);

    expect(watcherMocks.watch).toHaveBeenCalledOnce();
    expect(watcherMocks.close).not.toHaveBeenCalled();
  });

  it("rebuilds the watcher when a filesystem-relevant setting changes", async () => {
    await watchLibraryFolders([folder], [".mp3"]);
    await watchLibraryFolders([folder], [".flac"]);

    expect(watcherMocks.watch).toHaveBeenCalledTimes(2);
    expect(watcherMocks.close).toHaveBeenCalledOnce();
  });
});

it("uses one native recursive subscription per music root and coalesces changes", async () => {
  vi.useFakeTimers();
  watcherMocks.platform.mockReturnValue("darwin");
  await watchLibraryFolders([folder], [".mp3"]);
  expect(watcherMocks.nativeWatch).toHaveBeenCalledOnce();
  expect(watcherMocks.watch).not.toHaveBeenCalled();
  const notify = watcherMocks.nativeWatch.mock.calls[0][2] as (type: string, name: string) => void;
  notify("change", "album/song.mp3");
  notify("change", "album/song.mp3");
  notify("rename", "new-album");
  await vi.advanceTimersByTimeAsync(651);
  expect(watcherMocks.send).toHaveBeenCalledExactlyOnceWith("library:folder-changed", folder.id);
  watcherMocks.send.mockClear();
  notify("change", "album/cover.jpg");
  notify("rename", "node_modules/file.mp3");
  await vi.advanceTimersByTimeAsync(651);
  expect(watcherMocks.send).not.toHaveBeenCalled();
  await watchLibraryFolders([{ ...folder, trackIds: ["new"] }], [".mp3"]);
  expect(watcherMocks.nativeWatch).toHaveBeenCalledOnce();
  await closeFolderWatcher();
  expect(watcherMocks.close).toHaveBeenCalledOnce();
});
