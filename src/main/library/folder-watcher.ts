import type { FSWatcher } from "chokidar";
import chokidar from "chokidar";
import { BrowserWindow } from "electron";
import { extname } from "node:path";
import type { LibraryFolder } from "../../shared/library";
import { audioExtensions } from "./constants";

const notifyDelayMs = 650;
const ignoredDirectoryNames = new Set([
  ".cache",
  ".git",
  ".next",
  ".nuxt",
  ".output",
  ".parcel-cache",
  ".pnpm-store",
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
let watchedFolders: LibraryFolder[] = [];
let watchedExtensions = audioExtensions;
const pendingNotifications = new Map<string, NodeJS.Timeout>();

export async function watchLibraryFolders(
  folders: LibraryFolder[],
  extensions?: string[],
): Promise<void> {
  watchedFolders = folders;
  watchedExtensions =
    extensions && extensions.length > 0
      ? new Set(extensions.map((extension) => extension.toLowerCase()))
      : audioExtensions;

  if (watcher) {
    await watcher.close();
    watcher = null;
  }

  for (const timeout of pendingNotifications.values()) clearTimeout(timeout);
  pendingNotifications.clear();

  if (folders.length === 0) return;

  watcher = chokidar.watch(
    folders.map((folder) => folder.path),
    {
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100,
      },
      ignoreInitial: true,
      ignored: (filePath, stats) => {
        if (stats?.isDirectory() && ignoredDirectoryNames.has(filePath.split(/[\\/]/).pop() || "")) {
          return true;
        }

        return Boolean(stats?.isFile()) && !watchedExtensions.has(extname(filePath).toLowerCase());
      },
    },
  );

  watcher
    .on("add", notifyFolderForPath)
    .on("unlink", notifyFolderForPath)
    .on("change", notifyFolderForPath);
}

export async function closeFolderWatcher(): Promise<void> {
  if (!watcher) return;
  await watcher.close();
  watcher = null;
}

function notifyFolderForPath(filePath: string) {
  const folder = watchedFolders.find((item) => filePath.startsWith(item.path));
  if (!folder) return;

  const previousTimeout = pendingNotifications.get(folder.id);
  if (previousTimeout) clearTimeout(previousTimeout);

  pendingNotifications.set(
    folder.id,
    setTimeout(() => {
      pendingNotifications.delete(folder.id);
      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send("library:folder-changed", folder.id);
      }
    }, notifyDelayMs),
  );
}
