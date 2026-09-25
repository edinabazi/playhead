import { readFile, rename, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import chokidar, { type FSWatcher } from "chokidar";
import { electron } from "../electron";
import { readLibraryState } from "../library/store";
import { loadTrackLyrics, readLyricsFile, sidecarName } from "./lyrics";
import type { TrackLyrics } from "../../shared/lyrics";

const { app, ipcMain, dialog, BrowserWindow } = electron;
let writeQueue: Promise<unknown> = Promise.resolve();
async function selections(): Promise<Record<string, string>> {
  try {
    return JSON.parse(await readFile(join(app.getPath("userData"), "lyrics-files.json"), "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
}
async function localTrack(id: string) {
  const track = (await readLibraryState()).tracks[id];
  if (!track || track.source === "soundcloud")
    throw new Error("Choose a local track to add lyrics.");
  return track;
}
async function getLyrics(id: string): Promise<TrackLyrics> {
  const track = await localTrack(id);
  return loadTrackLyrics(track.path, (await selections())[id]);
}
function selectFile(id: string, filePath: string | null) {
  const write = writeQueue
    .catch(() => {})
    .then(async () => {
      await localTrack(id);
      if (filePath !== null) await readLyricsFile(filePath);
      const files = await selections();
      if (filePath === null) delete files[id];
      else files[id] = resolve(filePath);
      const destination = join(app.getPath("userData"), "lyrics-files.json");
      await writeFile(`${destination}.tmp`, JSON.stringify(files));
      await rename(`${destination}.tmp`, destination);
    });
  writeQueue = write;
  return write;
}

export function registerLyricsIpc() {
  ipcMain.handle("lyrics:get", (_event, id: string) => getLyrics(id));
  ipcMain.handle("lyrics:select", async (event, id: string, filePath?: string | null) => {
    await localTrack(id);
    if (filePath === undefined) {
      const options = {
        title: "Choose lyrics",
        filters: [{ name: "Lyrics", extensions: ["lrc"] }],
        properties: ["openFile"] as ["openFile"],
      };
      const parent = BrowserWindow.fromWebContents(event.sender);
      const result = parent
        ? await dialog.showOpenDialog(parent, options)
        : await dialog.showOpenDialog(options);
      if (result.canceled || !result.filePaths[0]) return null;
      filePath = result.filePaths[0];
    }
    await selectFile(id, filePath);
    return getLyrics(id);
  });
  const watches = new Map<
    number,
    { version: number; watcher?: FSWatcher; timer?: NodeJS.Timeout }
  >();
  ipcMain.handle("lyrics:watch", async (event, id: string | null) => {
    const sender = event.sender;
    let state = watches.get(sender.id);
    if (!state) {
      state = { version: 0 };
      watches.set(sender.id, state);
      sender.once("destroyed", () => {
        state!.version++;
        clearTimeout(state!.timer);
        void state!.watcher?.close();
        watches.delete(sender.id);
      });
    }
    const version = ++state.version;
    clearTimeout(state.timer);
    const previous = state.watcher;
    state.watcher = undefined;
    await previous?.close();
    if (!id) return;
    const track = await localTrack(id);
    const selectedFile = (await selections())[id];
    if (version !== state.version || sender.isDestroyed()) return;
    const audioPath = resolve(track.path);
    const directory = dirname(audioPath);
    const expected = sidecarName(audioPath).toLowerCase();
    const paths = [...new Set([directory, ...(selectedFile ? [dirname(selectedFile)] : [])])];
    const relevant = (path: string) =>
      resolve(path) === audioPath ||
      (selectedFile && resolve(path) === resolve(selectedFile)) ||
      (dirname(resolve(path)) === directory &&
        basename(path).toLowerCase() === expected &&
        extname(path).toLowerCase() === ".lrc");
    state.watcher = chokidar
      .watch(paths, {
        ignoreInitial: true,
        depth: 0,
        awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 100 },
        ignored: (path, stats) => Boolean(stats?.isFile()) && !relevant(path),
      })
      .on("all", (_name, path) => {
        if (!relevant(path)) return;
        clearTimeout(state!.timer);
        state!.timer = setTimeout(() => {
          if (version === state!.version && !sender.isDestroyed())
            sender.send("lyrics:changed", id);
        }, 100);
      })
      .on("error", () => {
        /* Explicit refresh remains available if a volume stops being watchable. */
      });
  });
}
