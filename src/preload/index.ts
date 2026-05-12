import type { IpcRendererEvent } from "electron";
import type {
  AppUpdateState,
  EditableTrackMetadata,
  LastfmTrackPayload,
  LibraryFolder,
  LibraryState,
  MediaCommand,
  PlayheadApi,
} from "../shared/library";
import { electron } from "./electron";

const { contextBridge, ipcRenderer, webUtils } = electron;

const api: PlayheadApi = {
  getAppVersion: () => ipcRenderer.invoke("app:get-version"),
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
  getUpdateState: () => ipcRenderer.invoke("app-updates:get-state"),
  checkForUpdates: () => ipcRenderer.invoke("app-updates:check"),
  installUpdate: () => ipcRenderer.invoke("app-updates:install"),
  getLastfmState: () => ipcRenderer.invoke("lastfm:get-state"),
  startLastfmAuth: () => ipcRenderer.invoke("lastfm:start-auth"),
  completeLastfmAuth: () => ipcRenderer.invoke("lastfm:complete-auth"),
  disconnectLastfm: () => ipcRenderer.invoke("lastfm:disconnect"),
  updateLastfmNowPlaying: (track: LastfmTrackPayload) =>
    ipcRenderer.invoke("lastfm:update-now-playing", track),
  scrobbleLastfmTrack: (track: LastfmTrackPayload) => ipcRenderer.invoke("lastfm:scrobble", track),
  loveLastfmTrack: (track: LastfmTrackPayload) => ipcRenderer.invoke("lastfm:love", track),
  unloveLastfmTrack: (track: LastfmTrackPayload) => ipcRenderer.invoke("lastfm:unlove", track),
  flushLastfmQueue: () => ipcRenderer.invoke("lastfm:flush-queue"),
  minimizeWindow: () => ipcRenderer.invoke("window:minimize"),
  toggleMaximizeWindow: () => ipcRenderer.invoke("window:toggle-maximize"),
  closeWindow: () => ipcRenderer.invoke("window:close"),
  moveWindowTo: (x: number, y: number) => ipcRenderer.invoke("window:move-to", x, y),
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
  onUpdateStateChanged: (callback: (state: AppUpdateState) => void) => {
    const listener = (_event: IpcRendererEvent, state: AppUpdateState) => callback(state);
    ipcRenderer.on("app-updates:state-changed", listener);
    return () => ipcRenderer.removeListener("app-updates:state-changed", listener);
  },
};

contextBridge.exposeInMainWorld("playhead", api);
