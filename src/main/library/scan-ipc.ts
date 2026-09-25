/// <reference types="electron-vite/node" />
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type { IpcMainInvokeEvent } from "electron";
import type { LibraryFolder } from "../../shared/library";
import type { LibraryScanRequest, LibraryScanResult } from "../../shared/library-scan";
import { electron } from "../electron";
import { writeArtwork } from "../artwork";
import { readLibraryState } from "./store";
import { ScanService } from "./scan-service";
import createWorker from "./scan-worker?nodeWorker";

export function registerScanIpc() {
  const { app, dialog, ipcMain } = electron;
  const service = new ScanService({
    createWorker: (data) => createWorker({ workerData: data }),
    getTracks: async () => (await readLibraryState()).tracks,
    artworkDirectory: join(app.getPath("userData"), "artwork"),
    writeArtwork,
  });
  const owners = new Set<number>();
  async function scan(
    event: IpcMainInvokeEvent,
    request: LibraryScanRequest,
  ): Promise<LibraryScanResult> {
    const owner = event.sender.id;
    if (!owners.has(owner)) {
      owners.add(owner);
      event.sender.once("destroyed", () => {
        service.cancel(owner);
        owners.delete(owner);
      });
    }
    let paths = request.paths;
    if (!paths) {
      const result = await dialog.showOpenDialog({
        properties: ["openDirectory", "multiSelections"],
        title: "Add music folder",
      });
      if (result.canceled || !result.filePaths.length) return { status: "cancelled" };
      paths = result.filePaths;
    }
    if (event.sender.isDestroyed()) return { status: "cancelled" };
    return service.run(owner, { ...request, paths: [...new Set(paths)] }, (progress) => {
      if (!event.sender.isDestroyed()) event.sender.send("library:scan-progress", progress);
    });
  }
  ipcMain.handle("library:scan", scan);
  ipcMain.handle("library:cancel-scan", (event, id: string) => service.cancel(event.sender.id, id));
  app.once("before-quit", () => {
    for (const owner of owners) service.cancel(owner);
  });

  // Older single-folder callers (including folder watchers) use the same bounded queue.
  const legacy = async (event: IpcMainInvokeEvent, paths?: string[], extensions?: string[]) => {
    const result = await scan(event, { id: randomUUID(), paths, extensions });
    return result.status === "completed" ? result.folders : [];
  };
  ipcMain.handle("library:select-folder", (event, extensions?: string[]) =>
    legacy(event, undefined, extensions),
  );
  ipcMain.handle(
    "library:scan-folder",
    async (event, folder: LibraryFolder, extensions?: string[]) =>
      (await legacy(event, [folder.path], extensions))[0],
  );
  ipcMain.handle(
    "library:scan-folder-path",
    async (event, path: string, extensions?: string[]) =>
      (await legacy(event, [path], extensions))[0],
  );
  ipcMain.handle("library:scan-folders", (event, folders: LibraryFolder[], extensions?: string[]) =>
    legacy(
      event,
      folders.map((folder) => folder.path),
      extensions,
    ),
  );
  ipcMain.handle("library:scan-folder-paths", (event, paths: string[], extensions?: string[]) =>
    legacy(event, paths, extensions),
  );
}
