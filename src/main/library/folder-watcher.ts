import type { FSWatcher } from "chokidar";
import chokidar from "chokidar";
import { watch, type FSWatcher as NativeWatcher } from "node:fs";
import { platform } from "node:os";
import { extname, sep } from "node:path";
import type { LibraryFolder } from "../../shared/library";
import { electron } from "../electron";
import { audioExtensions } from "./constants";

const { BrowserWindow } = electron;

const notifyDelayMs = 650;
const ignoredDirectoryNames = new Set([
  ".cache",
  ".git",
  ".next",
  ".nuxt",
  ".output",
  ".parcel-cache",
  ".svelte-kit",
  ".turbo",
  ".venv",
  ".vite",
  "bower_components",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "target",
  "vendor",
]);

let watcher: FSWatcher | null = null;
let nativeWatchers: NativeWatcher[] = [];
let watchedFolders: LibraryFolder[] = [];
let watchedExtensions = audioExtensions;
let watcherSignature = "";
const pendingNotifications = new Map<string, NodeJS.Timeout>();

function getWatcherSignature(folders: LibraryFolder[], extensions: Set<string>): string {
  return JSON.stringify({
    folders: folders
      .map((folder) => [folder.id, folder.path])
      .sort(([left], [right]) => left.localeCompare(right)),
    extensions: Array.from(extensions).sort(),
  });
}

export async function watchLibraryFolders(
  folders: LibraryFolder[],
  extensions?: string[],
): Promise<void> {
  const nextExtensions =
    extensions && extensions.length > 0
      ? new Set(extensions.map((extension) => extension.toLowerCase()))
      : audioExtensions;
  const nextSignature = getWatcherSignature(folders, nextExtensions);
  watchedFolders = folders;
  watchedExtensions = nextExtensions;

  if ((watcher || nativeWatchers.length) && watcherSignature === nextSignature) return;

  for (const nativeWatcher of nativeWatchers) nativeWatcher.close();
  nativeWatchers = [];

  if (watcher) {
    await watcher.close();
    watcher = null;
  }

  for (const timeout of pendingNotifications.values()) clearTimeout(timeout);
  pendingNotifications.clear();

  if (folders.length === 0) {
    watcherSignature = "";
    return;
  }

  watcherSignature = nextSignature;

  // macOS and Windows provide a recursive OS subscription. Avoid a separate watcher
  // and startup stat for every track, which is expensive for six-figure libraries.
  if (platform() === "darwin" || platform() === "win32") {
    try {
      for (const folder of folders) {
        const nativeWatcher = watch(folder.path, { recursive: true }, (event, filename) => {
          const name = filename?.toString();
          if (name?.split(/[\\/]/).some((part) => ignoredDirectoryNames.has(part))) return;
          // Renames also cover moving an entire album into or out of the library.
          if (!name || event === "rename" || watchedExtensions.has(extname(name).toLowerCase()))
            notifyFolder(folder.id);
        });
        nativeWatcher.on("error", (error) => {
          console.warn("Music folder watching interrupted", error);
          nativeWatcher.close();
          nativeWatchers = nativeWatchers.filter((item) => item !== nativeWatcher);
          watcherSignature = "";
        });
        nativeWatchers.push(nativeWatcher);
      }
      return;
    } catch {
      for (const nativeWatcher of nativeWatchers) nativeWatcher.close();
      nativeWatchers = [];
      // Retain the existing watcher on filesystems without recursive notifications.
    }
  }

  watcher = chokidar.watch(
    folders.map((folder) => folder.path),
    {
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100,
      },
      ignoreInitial: true,
      followSymlinks: false,
      ignored: (filePath, stats) => {
        if (
          stats?.isDirectory() &&
          ignoredDirectoryNames.has(filePath.split(/[\\/]/).pop() || "")
        ) {
          return true;
        }

        return Boolean(stats?.isFile()) && !watchedExtensions.has(extname(filePath).toLowerCase());
      },
    },
  );

  watcher
    .on("add", notifyFolderForPath)
    .on("unlink", notifyFolderForPath)
    .on("change", notifyFolderForPath)
    .on("error", (error) => console.warn("Music folder watching interrupted", error));
}

export async function closeFolderWatcher(): Promise<void> {
  for (const nativeWatcher of nativeWatchers) nativeWatcher.close();
  nativeWatchers = [];
  if (watcher) await watcher.close();
  watcher = null;
  watcherSignature = "";
  watchedFolders = [];

  for (const timeout of pendingNotifications.values()) clearTimeout(timeout);
  pendingNotifications.clear();
}

function notifyFolderForPath(filePath: string) {
  for (const folder of watchedFolders) {
    if (
      filePath === folder.path ||
      filePath.startsWith(folder.path.endsWith(sep) ? folder.path : `${folder.path}${sep}`)
    )
      notifyFolder(folder.id);
  }
}

function notifyFolder(folderId: string) {
  const previousTimeout = pendingNotifications.get(folderId);
  if (previousTimeout) clearTimeout(previousTimeout);

  pendingNotifications.set(
    folderId,
    setTimeout(() => {
      pendingNotifications.delete(folderId);
      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send("library:folder-changed", folderId);
      }
    }, notifyDelayMs),
  );
}
