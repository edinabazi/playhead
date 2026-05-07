import type { IpcRendererEvent } from "electron";
import type {
  EditableTrackMetadata,
  LibraryFolder,
  LibraryState,
  MediaCommand,
  PlayheadApi,
} from "../shared/library";
import { electron } from "./electron";

const { contextBridge, ipcRenderer, webUtils } = electron;

const api: PlayheadApi = {
  getLibraryState: () => ipcRenderer.invoke("library:get-state"),
  saveLibraryState: (state: LibraryState) => ipcRenderer.invoke("library:save-state", state),
  selectMusicFolder: (extensions?: string[]) =>
    ipcRenderer.invoke("library:select-folder", extensions),
  scanFolder: (folder: LibraryFolder, extensions?: string[]) =>
    ipcRenderer.invoke("library:scan-folder", folder, extensions),
  scanFolderPath: (path: string, extensions?: string[]) =>
    ipcRenderer.invoke("library:scan-folder-path", path, extensions),
  getDroppedFilePath: (file: File) => webUtils.getPathForFile(file),
  getAudioFileUrl: (path: string) => ipcRenderer.invoke("library:get-audio-url", path),
  readAudioFile: (path: string) => ipcRenderer.invoke("library:read-audio-file", path),
  getTrackMetadata: (path: string) => ipcRenderer.invoke("library:get-track-metadata", path),
  saveTrackMetadata: (path: string, folderId: string, metadata: EditableTrackMetadata) =>
    ipcRenderer.invoke("library:save-track-metadata", path, folderId, metadata),
  watchLibraryFolders: (folders: LibraryFolder[], extensions?: string[]) =>
    ipcRenderer.invoke("library:watch-folders", folders, extensions),
  showItemInFolder: (path: string) => ipcRenderer.invoke("library:show-item", path),
  openDataFolder: () => ipcRenderer.invoke("library:open-data-folder"),
  clearWaveformCache: () => ipcRenderer.invoke("library:clear-waveform-cache"),
  exportLibraryBackup: (state: LibraryState) => ipcRenderer.invoke("library:export-backup", state),
  importLibraryBackup: () => ipcRenderer.invoke("library:import-backup"),
  trackEvent: (eventName: string, properties?: Record<string, string | number | boolean>) => {
    void ipcRenderer.invoke("telemetry:track", eventName, properties);
  },
  onMediaCommand: (callback: (command: MediaCommand) => void) => {
    const listener = (_event: IpcRendererEvent, command: MediaCommand) => callback(command);
    ipcRenderer.on("media-command", listener);
    return () => ipcRenderer.removeListener("media-command", listener);
  },
  onFolderChanged: (callback: (folderId: string) => void) => {
    const listener = (_event: IpcRendererEvent, folderId: string) => callback(folderId);
    ipcRenderer.on("library:folder-changed", listener);
    return () => ipcRenderer.removeListener("library:folder-changed", listener);
  },
};

contextBridge.exposeInMainWorld("playhead", api);
