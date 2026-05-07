import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { app, dialog, ipcMain, shell } from "electron";
import type { EditableTrackMetadata, LibraryFolder, LibraryState } from "../../shared/library";
import { readTrackMetadata, saveTrackMetadata } from "../metadata/metadata";
import { watchLibraryFolders } from "./folder-watcher";
import { scanFolderPath } from "./scanner";
import { normalizeLibraryState, readLibraryState, writeLibraryState } from "./store";

export function registerLibraryIpc(): void {
  ipcMain.handle("library:get-state", () => readLibraryState());

  ipcMain.handle("library:save-state", async (_event, state: LibraryState) => {
    return writeLibraryState(state);
  });

  ipcMain.handle("library:select-folder", async (_event, extensions?: string[]) => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
      title: "Add music folder",
    });

    if (result.canceled || !result.filePaths[0]) return null;

    return scanFolderPath(result.filePaths[0], extensions);
  });

  ipcMain.handle(
    "library:scan-folder",
    async (_event, folder: LibraryFolder, extensions?: string[]) => {
      return scanFolderPath(folder.path, extensions);
    },
  );

  ipcMain.handle(
    "library:scan-folder-path",
    async (_event, folderPath: string, extensions?: string[]) => {
      return scanFolderPath(folderPath, extensions);
    },
  );

  ipcMain.handle(
    "library:watch-folders",
    async (_event, folders: LibraryFolder[], extensions?: string[]) => {
      await watchLibraryFolders(folders, extensions);
    },
  );

  ipcMain.handle("library:get-audio-url", (_event, filePath: string) => {
    return pathToFileURL(filePath).toString();
  });

  ipcMain.handle("library:read-audio-file", async (_event, filePath: string) => {
    const bytes = await readFile(filePath);
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  });

  ipcMain.handle("library:get-track-metadata", async (_event, filePath: string) => {
    return readTrackMetadata(filePath);
  });

  ipcMain.handle(
    "library:save-track-metadata",
    async (_event, filePath: string, folderId: string, metadata: EditableTrackMetadata) => {
      return saveTrackMetadata(filePath, folderId, metadata);
    },
  );

  ipcMain.handle("library:show-item", (_event, filePath: string) => {
    shell.showItemInFolder(filePath);
  });

  ipcMain.handle("library:open-data-folder", async () => {
    await shell.openPath(app.getPath("userData"));
  });

  ipcMain.handle("library:clear-waveform-cache", async () => {
    await rm(join(app.getPath("userData"), "waveforms"), { recursive: true, force: true });
  });

  ipcMain.handle("library:export-backup", async (_event, state: LibraryState) => {
    const result = await dialog.showSaveDialog({
      title: "Export Playhead Backup",
      defaultPath: "playhead-library-backup.json",
      filters: [{ name: "JSON", extensions: ["json"] }],
    });

    if (result.canceled || !result.filePath) return false;
    await writeFile(result.filePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    return true;
  });

  ipcMain.handle("library:import-backup", async () => {
    const result = await dialog.showOpenDialog({
      title: "Import Playhead Backup",
      properties: ["openFile"],
      filters: [{ name: "JSON", extensions: ["json"] }],
    });

    if (result.canceled || !result.filePaths[0]) return null;

    const raw = await readFile(result.filePaths[0], "utf8");
    const imported = await normalizeLibraryState(JSON.parse(raw) as Partial<LibraryState>);
    return writeLibraryState(imported);
  });
}
