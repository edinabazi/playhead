// @vitest-environment node
import { EventEmitter } from "node:events";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPath: vi.fn(),
  handle: vi.fn(),
  readState: vi.fn(),
  watch: vi.fn(),
}));
vi.mock("../../electron", () => ({
  electron: {
    app: { getPath: mocks.getPath },
    ipcMain: { handle: mocks.handle },
    dialog: {},
    BrowserWindow: {},
  },
}));
vi.mock("../../library/store", () => ({ readLibraryState: mocks.readState }));
vi.mock("chokidar", () => ({ default: { watch: mocks.watch } }));
import { registerLyricsIpc } from "../lyrics-ipc";
let directory: string;
let handlers: Record<string, (...args: unknown[]) => Promise<unknown>>;
let watcher: EventEmitter & { close: ReturnType<typeof vi.fn> };
let sender: EventEmitter & {
  id: number;
  send: ReturnType<typeof vi.fn>;
  isDestroyed: () => boolean;
};
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "playhead-lyrics-ipc-"));
  mocks.getPath.mockReturnValue(directory);
  mocks.readState
    .mockReset()
    .mockResolvedValue({ tracks: { one: { path: join(directory, "music", "Song.wav") } } });
  mocks.handle.mockClear();
  watcher = Object.assign(new EventEmitter(), { close: vi.fn().mockResolvedValue(undefined) });
  sender = Object.assign(new EventEmitter(), { id: 1, send: vi.fn(), isDestroyed: () => false });
  mocks.watch.mockReset().mockReturnValue(watcher);
  registerLyricsIpc();
  handlers = Object.fromEntries(mocks.handle.mock.calls);
});
afterEach(async () => {
  sender.emit("destroyed");
  vi.useRealTimers();
  await rm(directory, { recursive: true, force: true });
});
it("persists validated file selections and leaves the previous selection intact after an invalid import", async () => {
  const selected = join(directory, "chosen.lrc");
  const invalid = join(directory, "invalid.lrc");
  await writeFile(selected, "[00:01]Lyrics");
  await writeFile(invalid, "[ti:No lyrics]");
  const result = await handlers["lyrics:select"]({ sender }, "one", selected);
  expect(result).toMatchObject({ custom: true, fileName: "chosen.lrc" });
  await expect(handlers["lyrics:select"]({ sender }, "one", invalid)).rejects.toThrow(
    "readable lyrics",
  );
  expect(JSON.parse(await readFile(join(directory, "lyrics-files.json"), "utf8"))).toEqual({
    one: selected,
  });
});
it("watches parent directories so deleted chosen files can reappear, and ignores unrelated changes", async () => {
  const external = join(directory, "external", "chosen.lrc");
  await mkdir(join(directory, "external"));
  await writeFile(join(directory, "lyrics-files.json"), JSON.stringify({ one: external }));
  await handlers["lyrics:watch"]({ sender }, "one");
  expect(mocks.watch.mock.calls[0][0]).toEqual([
    join(directory, "music"),
    join(directory, "external"),
  ]);
  vi.useFakeTimers();
  watcher.emit("all", "change", join(directory, "external", "unrelated.txt"));
  await vi.advanceTimersByTimeAsync(150);
  expect(sender.send).not.toHaveBeenCalled();
  watcher.emit("all", "unlink", external);
  await vi.advanceTimersByTimeAsync(150);
  watcher.emit("all", "add", external);
  await vi.advanceTimersByTimeAsync(150);
  expect(sender.send).toHaveBeenCalledTimes(2);
  expect(sender.send).toHaveBeenLastCalledWith("lyrics:changed", "one");
  await handlers["lyrics:watch"]({ sender }, null);
  expect(watcher.close).toHaveBeenCalledOnce();
});
it("doesn't attach an outdated watcher after a track switch or closing lyrics", async () => {
  let finish!: (value: unknown) => void;
  mocks.readState.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const old = handlers["lyrics:watch"]({ sender }, "one");
  await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
  await handlers["lyrics:watch"]({ sender }, null);
  finish({ tracks: { one: { path: join(directory, "old.wav") } } });
  await old;
  expect(mocks.watch).not.toHaveBeenCalled();
});
