import { fileResponse } from "../media/file-response";
import { PlaybackCopies } from "../media/playback-copy";
import { playbackFailure } from "../../shared/playback";
import { createReadStream } from "node:fs";
import { readFile, rm, stat, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import type {
  EditableTrackMetadata,
  LibraryFolder,
  LibraryState,
  LibraryTrack,
  PlaylistExportRequest,
  WaveformCacheRequest,
  WaveformCacheWrite,
  BpmCacheRequest,
  BpmCacheWrite,
  SelectedSource,
} from "../../shared/library";
import { electron } from "../electron";
import { decodeArtworkPath } from "../artwork";
import { readTrackMetadata, saveTrackMetadata } from "../metadata/metadata";
import { watchLibraryFolders } from "./folder-watcher";
import { scanFolderPath } from "./scanner";
import {
  normalizeLibraryState,
  readLibraryState,
  writeLibrarySelectedSource,
  writeLibrarySessionSettings,
  writeLibraryState,
  writeLibraryTrackAnalysis,
} from "./store";
import {
  invalidateWaveformCacheIndex,
  readWaveformCache,
  writeWaveformCache,
} from "./waveform-cache";
import { readBpmCache, writeBpmCache } from "./bpm-cache";
import {
  buildPlaylistExportContent,
  getPlaylistExportDefaultPath,
  getPlaylistExportFilter,
  isSupportedPlaylistExportFormat,
  parsePlaylistImportFile,
} from "./playlist-export";

const { app, dialog, ipcMain, protocol, shell } = electron;
const folderScanConcurrency = 2;

async function scanFolderPathsWithConcurrency(
  folderPaths: string[],
  extensions: string[] | undefined,
  existingTracks: LibraryState["tracks"],
): Promise<Awaited<ReturnType<typeof scanFolderPath>>[]> {
  const scannedFolders = new Array<Awaited<ReturnType<typeof scanFolderPath>>>(folderPaths.length);
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(folderScanConcurrency, folderPaths.length) },
    async () => {
      while (nextIndex < folderPaths.length) {
        const index = nextIndex;
        nextIndex += 1;
        scannedFolders[index] = await scanFolderPath(
          folderPaths[index],
          extensions,
          existingTracks,
        );
      }
    },
  );

  await Promise.all(workers);
  return scannedFolders;
}

function encodeMediaPath(filePath: string): string {
  return Buffer.from(filePath, "utf8").toString("base64url");
}

function decodeMediaPath(url: string): string {
  const encodedPath = new URL(url).pathname.slice(1);
  return Buffer.from(encodedPath, "base64url").toString("utf8");
}

const artworkHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=31536000, immutable",
  "Content-Type": "image/png",
};

async function handleMediaRequest(request: Request): Promise<Response> {
  return fileResponse(decodeMediaPath(request.url), request);
}

function getArtworkDirectory(): string {
  return join(app.getPath("userData"), "artwork");
}

function isArtworkPathAllowed(filePath: string): boolean {
  const artworkDirectory = resolve(getArtworkDirectory());
  const resolvedPath = resolve(filePath);
  return resolvedPath === artworkDirectory || resolvedPath.startsWith(`${artworkDirectory}${sep}`);
}

async function handleArtworkRequest(request: Request): Promise<Response> {
  try {
    const filePath = decodeArtworkPath(request.url);
    if (!isArtworkPathAllowed(filePath)) return new Response(null, { status: 403 });

    const fileInfo = await stat(filePath);
    if (!fileInfo.isFile()) return new Response(null, { status: 404 });

    return new Response(Readable.toWeb(createReadStream(filePath)) as BodyInit, {
      headers: {
        ...artworkHeaders,
        "Content-Length": String(fileInfo.size),
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}

export function registerLibraryIpc(): void {
  const copies = new PlaybackCopies(app.getPath("temp"));
  const preparations = new Map<number, { id: number; controller: AbortController }>();
  ipcMain.handle("library:prepare-playback-copy", async (event, path: string, id: number) => {
    preparations.get(event.sender.id)?.controller.abort();
    const controller = new AbortController();
    preparations.set(event.sender.id, { id, controller });
    const cancel = () => controller.abort();
    event.sender.once("destroyed", cancel);
    const timeout = setTimeout(cancel, 45_000);
    try {
      const pending = copies.prepare(path, controller.signal);
      const localPath = await new Promise<string>((resolve, reject) => {
        const aborted = () =>
          reject(Object.assign(new Error("Playback preparation cancelled"), { code: "ETIMEDOUT" }));
        controller.signal.addEventListener("abort", aborted, { once: true });
        pending
          .then(resolve, reject)
          .finally(() => controller.signal.removeEventListener("abort", aborted));
      });
      return { url: `playhead-media://audio/${encodeMediaPath(localPath)}` };
    } catch (error) {
      return {
        failure: playbackFailure(controller.signal.aborted ? { code: "ETIMEDOUT" } : error),
      };
    } finally {
      clearTimeout(timeout);
      event.sender.removeListener("destroyed", cancel);
      if (preparations.get(event.sender.id)?.id === id) preparations.delete(event.sender.id);
    }
  });
  ipcMain.handle("library:cancel-playback-copy", (event, id: number) => {
    const preparation = preparations.get(event.sender.id);
    if (preparation?.id === id) preparation.controller.abort();
  });
  app.once("before-quit", () => {
    for (const preparation of preparations.values()) preparation.controller.abort();
    void copies.dispose().catch(() => {});
  });

  if (protocol.isProtocolHandled("playhead-media")) {
    protocol.unhandle("playhead-media");
  }
  protocol.handle("playhead-media", handleMediaRequest);
  if (protocol.isProtocolHandled("playhead-artwork")) {
    protocol.unhandle("playhead-artwork");
  }
  protocol.handle("playhead-artwork", handleArtworkRequest);

  ipcMain.handle("library:get-state", () => readLibraryState());

  ipcMain.handle("library:save-state", async (_event, state: LibraryState) => {
    return writeLibraryState(state);
  });

  ipcMain.handle(
    "library:save-session-settings",
    async (_event, session: LibraryState["settings"]["session"]) => {
      return writeLibrarySessionSettings(session);
    },
  );

  ipcMain.handle("library:save-track-analysis", async (_event, trackId: string, bpm: number) => {
    return writeLibraryTrackAnalysis(trackId, bpm);
  });

  ipcMain.handle(
    "library:save-selected-source",
    async (_event, selectedSource: SelectedSource | null) => {
      return writeLibrarySelectedSource(selectedSource);
    },
  );

  ipcMain.handle("library:select-folder", async (_event, extensions?: string[]) => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory", "multiSelections"],
      title: "Add music folder",
    });

    if (result.canceled || result.filePaths.length === 0) return [];

    const existingState = await readLibraryState();
    return scanFolderPathsWithConcurrency(result.filePaths, extensions, existingState.tracks);
  });

  ipcMain.handle(
    "library:scan-folder",
    async (_event, folder: LibraryFolder, extensions?: string[]) => {
      const existingState = await readLibraryState();
      return scanFolderPath(folder.path, extensions, existingState.tracks);
    },
  );

  ipcMain.handle(
    "library:scan-folder-path",
    async (_event, folderPath: string, extensions?: string[]) => {
      const existingState = await readLibraryState();
      return scanFolderPath(folderPath, extensions, existingState.tracks);
    },
  );

  ipcMain.handle(
    "library:scan-folders",
    async (_event, folders: LibraryFolder[], extensions?: string[]) => {
      const existingState = await readLibraryState();
      return scanFolderPathsWithConcurrency(
        folders.map((folder) => folder.path),
        extensions,
        existingState.tracks,
      );
    },
  );

  ipcMain.handle(
    "library:scan-folder-paths",
    async (_event, folderPaths: string[], extensions?: string[]) => {
      const existingState = await readLibraryState();
      return scanFolderPathsWithConcurrency(folderPaths, extensions, existingState.tracks);
    },
  );

  ipcMain.handle(
    "library:watch-folders",
    async (_event, folders: LibraryFolder[], extensions?: string[]) => {
      await watchLibraryFolders(folders, extensions);
    },
  );

  ipcMain.handle("library:get-audio-url", (_event, filePath: string) => {
    return `playhead-media://audio/${encodeMediaPath(filePath)}`;
  });

  ipcMain.handle("library:read-audio-file", async (_event, filePath: string) => {
    const bytes = await readFile(filePath);
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  });

  ipcMain.handle("library:get-audio-file-revision", async (_event, filePath: string) => {
    const fileInfo = await stat(filePath);
    return { size: fileInfo.size, mtimeMs: fileInfo.mtimeMs };
  });

  ipcMain.handle("library:get-waveform-cache", async (_event, request: WaveformCacheRequest) => {
    return readWaveformCache(request, {
      directory: join(app.getPath("userData"), "waveforms"),
    });
  });

  ipcMain.handle("library:save-waveform-cache", async (_event, write: WaveformCacheWrite) => {
    await writeWaveformCache(write, {
      directory: join(app.getPath("userData"), "waveforms"),
    });
  });

  ipcMain.handle("library:get-bpm-cache", async (_event, request: BpmCacheRequest) => {
    return readBpmCache(request, {
      directory: join(app.getPath("userData"), "bpm"),
    });
  });

  ipcMain.handle("library:save-bpm-cache", async (_event, write: BpmCacheWrite) => {
    await writeBpmCache(write, {
      directory: join(app.getPath("userData"), "bpm"),
    });
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
    const directory = join(app.getPath("userData"), "waveforms");
    invalidateWaveformCacheIndex(directory);
    await rm(directory, { recursive: true, force: true });
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

  ipcMain.handle("library:export-playlist", async (_event, request: PlaylistExportRequest) => {
    if (!isSupportedPlaylistExportFormat(request.format)) {
      throw new Error("Unsupported playlist export format.");
    }

    const state = await readLibraryState();
    const playlist = state.playlists.find((item) => item.id === request.playlistId);
    if (!playlist) throw new Error("Playlist not found.");

    const tracks = playlist.trackIds
      .map((trackId) => state.tracks[trackId])
      .filter((track): track is LibraryTrack => Boolean(track));
    const exportResult = buildPlaylistExportContent(playlist, tracks, request.format);
    const skippedTrackCount =
      exportResult.skippedTrackCount + Math.max(0, playlist.trackIds.length - tracks.length);

    if (exportResult.exportedTrackCount === 0 && request.format !== "playhead") {
      throw new Error("This playlist has no local tracks to export.");
    }

    const result = await dialog.showSaveDialog({
      title: `Export ${playlist.name}`,
      defaultPath: getPlaylistExportDefaultPath(playlist.name, request.format),
      filters: [getPlaylistExportFilter(request.format)],
    });

    if (result.canceled || !result.filePath) {
      return {
        canceled: true,
        exportedTrackCount: 0,
        skippedTrackCount: 0,
      };
    }

    await writeFile(result.filePath, exportResult.content, "utf8");
    return {
      canceled: false,
      filePath: result.filePath,
      exportedTrackCount: exportResult.exportedTrackCount,
      skippedTrackCount,
    };
  });

  ipcMain.handle("library:import-playlist", async () => {
    const result = await dialog.showOpenDialog({
      title: "Import Playlist",
      properties: ["openFile"],
      filters: [
        {
          name: "DJ and Playhead playlists",
          extensions: ["m3u", "m3u8", "json", "xml", "nml", "crate"],
        },
        { name: "M3U", extensions: ["m3u", "m3u8"] },
        { name: "Playhead Playlist", extensions: ["json"] },
        { name: "rekordbox XML", extensions: ["xml"] },
        { name: "Traktor NML", extensions: ["nml"] },
        { name: "Serato Crate", extensions: ["crate"] },
      ],
    });

    if (result.canceled || !result.filePaths[0]) {
      return {
        canceled: true,
        playlists: [],
      };
    }

    const filePath = result.filePaths[0];
    const parsed = parsePlaylistImportFile(filePath, await readFile(filePath));
    return {
      canceled: false,
      filePath,
      ...parsed,
    };
  });
}
