import type { IpcRendererEvent } from "electron";
import type {
  AppUpdateState,
  BpmCacheRequest,
  BpmCacheWrite,
  EditableTrackMetadata,
  LastfmTrackPayload,
  LibraryFolder,
  LibraryState,
  MediaCommand,
  PlayheadApi,
  SoundCloudCollectionId,
  SoundCloudState,
  SoundCloudTranscoding,
  WaveformCacheRequest,
  WaveformCacheWrite,
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
  getWaveformCache: (request: WaveformCacheRequest) =>
    ipcRenderer.invoke("library:get-waveform-cache", request),
  saveWaveformCache: (write: WaveformCacheWrite) =>
    ipcRenderer.invoke("library:save-waveform-cache", write),
  getBpmCache: (request: BpmCacheRequest) => ipcRenderer.invoke("library:get-bpm-cache", request),
  saveBpmCache: (write: BpmCacheWrite) => ipcRenderer.invoke("library:save-bpm-cache", write),
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
  getSoundCloudState: () => ipcRenderer.invoke("soundcloud:get-state"),
  startSoundCloudAuth: () => ipcRenderer.invoke("soundcloud:start-auth"),
  completeSoundCloudAuth: (input: string) => {
    let code = input.trim();
    let state: string | undefined;
    try {
      const url = new URL(code);
      code = url.searchParams.get("code") || code;
      state = url.searchParams.get("state") || undefined;
    } catch {
      // Plain authorization codes are accepted.
    }
    return ipcRenderer.invoke("soundcloud:complete-auth", code, state);
  },
  disconnectSoundCloud: () => ipcRenderer.invoke("soundcloud:disconnect"),
  getSoundCloudCollections: (visibleCollections: SoundCloudCollectionId[]) =>
    ipcRenderer.invoke("soundcloud:get-collections", visibleCollections),
  getSoundCloudCollectionTracks: (collectionId: string) =>
    ipcRenderer.invoke("soundcloud:get-collection-tracks", collectionId),
  getSoundCloudStreamUrl: (
    trackId: number,
    streamUrl?: string,
    transcodings?: SoundCloudTranscoding[],
    trackAuthorization?: string,
  ) =>
    ipcRenderer.invoke(
      "soundcloud:get-stream-url",
      trackId,
      streamUrl,
      transcodings,
      trackAuthorization,
    ),
  getSoundCloudProgressiveStreamUrl: (
    trackId: number,
    transcodings?: SoundCloudTranscoding[],
    trackAuthorization?: string,
  ) =>
    ipcRenderer.invoke(
      "soundcloud:get-progressive-stream-url",
      trackId,
      transcodings,
      trackAuthorization,
    ),
  getSoundCloudAnalysisAudioData: (
    trackId: number,
    durationSeconds: number,
    transcodings?: SoundCloudTranscoding[],
    trackAuthorization?: string,
  ) =>
    ipcRenderer.invoke(
      "soundcloud:get-analysis-audio-data",
      trackId,
      durationSeconds,
      transcodings,
      trackAuthorization,
    ),
  getSoundCloudImageUrl: (url: string) => ipcRenderer.invoke("soundcloud:get-image-url", url),
  getSoundCloudWaveformPeaks: (trackId: number, url?: string) =>
    ipcRenderer.invoke("soundcloud:get-waveform-peaks", trackId, url),
  onSoundCloudStateChanged: (callback: (state: SoundCloudState) => void) => {
    const listener = (_event: IpcRendererEvent, state: SoundCloudState) => callback(state);
    ipcRenderer.on("soundcloud:state-changed", listener);
    return () => ipcRenderer.removeListener("soundcloud:state-changed", listener);
  },
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
