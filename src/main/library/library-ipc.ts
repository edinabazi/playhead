import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { dialog, ipcMain, shell } from "electron";
import type { EditableTrackMetadata, LibraryFolder, LibraryState } from "../../shared/library";
import { readTrackMetadata, saveTrackMetadata } from "../metadata/metadata";
import { watchLibraryFolders } from "./folder-watcher";
import { scanFolderPath } from "./scanner";
import { readLibraryState, writeLibraryState } from "./store";

export function registerLibraryIpc(): void {
  ipcMain.handle("library:get-state", () => readLibraryState());

  ipcMain.handle("library:save-state", async (_event, state: LibraryState) => {
    return writeLibraryState(state);
  });

  ipcMain.handle("library:select-folder", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
      title: "Add music folder",
    });

    if (result.canceled || !result.filePaths[0]) return null;

    return scanFolderPath(result.filePaths[0]);
  });

  ipcMain.handle("library:scan-folder", async (_event, folder: LibraryFolder) => {
    return scanFolderPath(folder.path);
  });

  ipcMain.handle("library:scan-folder-path", async (_event, folderPath: string) => {
    return scanFolderPath(folderPath);
  });

  ipcMain.handle("library:watch-folders", async (_event, folders: LibraryFolder[]) => {
    await watchLibraryFolders(folders);
  });

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
}
