import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from "electron";
import type {
  EditableTrackMetadata,
  LibraryFolder,
  LibraryState,
  MediaCommand,
  PlayheadApi,
} from "../shared/library";

const api: PlayheadApi = {
  getLibraryState: () => ipcRenderer.invoke("library:get-state"),
  saveLibraryState: (state: LibraryState) => ipcRenderer.invoke("library:save-state", state),
  selectMusicFolder: () => ipcRenderer.invoke("library:select-folder"),
  scanFolder: (folder: LibraryFolder) => ipcRenderer.invoke("library:scan-folder", folder),
  scanFolderPath: (path: string) => ipcRenderer.invoke("library:scan-folder-path", path),
  getDroppedFilePath: (file: File) => webUtils.getPathForFile(file),
  getAudioFileUrl: (path: string) => ipcRenderer.invoke("library:get-audio-url", path),
  readAudioFile: (path: string) => ipcRenderer.invoke("library:read-audio-file", path),
  getTrackMetadata: (path: string) => ipcRenderer.invoke("library:get-track-metadata", path),
  saveTrackMetadata: (path: string, folderId: string, metadata: EditableTrackMetadata) =>
    ipcRenderer.invoke("library:save-track-metadata", path, folderId, metadata),
  watchLibraryFolders: (folders: LibraryFolder[]) =>
    ipcRenderer.invoke("library:watch-folders", folders),
  showItemInFolder: (path: string) => ipcRenderer.invoke("library:show-item", path),
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
