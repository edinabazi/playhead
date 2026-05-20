import { createReadStream } from "node:fs";
import { readFile, rm, stat, writeFile } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import type {
  EditableTrackMetadata,
  LibraryFolder,
  LibraryState,
  ScannedFolder,
  WaveformCacheRequest,
  WaveformCacheWrite,
  BpmCacheRequest,
  BpmCacheWrite,
} from "../../shared/library";
import { electron } from "../electron";
import { decodeArtworkPath } from "../artwork";
import { readTrackMetadata, saveTrackMetadata } from "../metadata/metadata";
import { watchLibraryFolders } from "./folder-watcher";
import { scanFolderPath } from "./scanner";
import { normalizeLibraryState, readLibraryState, writeLibraryState } from "./store";
import { readWaveformCache, writeWaveformCache } from "./waveform-cache";
import { readBpmCache, writeBpmCache } from "./bpm-cache";

const { app, dialog, ipcMain, protocol, shell } = electron;

function encodeMediaPath(filePath: string): string {
  return Buffer.from(filePath, "utf8").toString("base64url");
}

function decodeMediaPath(url: string): string {
  const encodedPath = new URL(url).pathname.slice(1);
  return Buffer.from(encodedPath, "base64url").toString("utf8");
}

const audioMimeTypes: Record<string, string> = {
  ".aac": "audio/aac",
  ".aif": "audio/aiff",
  ".aiff": "audio/aiff",
  ".flac": "audio/flac",
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".opus": "audio/ogg",
  ".wav": "audio/wav",
};

function getAudioMimeType(filePath: string): string {
  return audioMimeTypes[extname(filePath).toLowerCase()] || "application/octet-stream";
}

const mediaHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Accept-Ranges": "bytes",
};

const artworkHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=31536000, immutable",
  "Content-Type": "image/png",
};

async function handleMediaRequest(request: Request): Promise<Response> {
  const filePath = decodeMediaPath(request.url);
  const fileInfo = await stat(filePath);
  const fileSize = fileInfo.size;
  const contentType = getAudioMimeType(filePath);
  const range = request.headers.get("range");

  if (!range) {
    return new Response(Readable.toWeb(createReadStream(filePath)) as BodyInit, {
      headers: {
        ...mediaHeaders,
        "Content-Length": String(fileSize),
        "Content-Type": contentType,
      },
    });
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match) {
    return new Response(null, {
      status: 416,
      headers: {
        ...mediaHeaders,
        "Content-Range": `bytes */${fileSize}`,
      },
    });
  }

  const start = match[1] ? Number.parseInt(match[1], 10) : 0;
  const requestedEnd = match[2] ? Number.parseInt(match[2], 10) : fileSize - 1;
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(requestedEnd) ||
    start < 0 ||
    start > requestedEnd ||
    start >= fileSize
  ) {
    return new Response(null, {
      status: 416,
      headers: {
        ...mediaHeaders,
        "Content-Range": `bytes */${fileSize}`,
      },
    });
  }

  const end = Math.min(requestedEnd, fileSize - 1);
  return new Response(Readable.toWeb(createReadStream(filePath, { start, end })) as BodyInit, {
    status: 206,
    headers: {
      ...mediaHeaders,
      "Content-Length": String(end - start + 1),
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Content-Type": contentType,
    },
  });
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

  ipcMain.handle("library:select-folder", async (_event, extensions?: string[]) => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory", "multiSelections"],
      title: "Add music folder",
    });

    if (result.canceled || result.filePaths.length === 0) return [];

    const existingState = await readLibraryState();
    const scannedFolders: ScannedFolder[] = [];
    for (const folderPath of result.filePaths) {
      scannedFolders.push(await scanFolderPath(folderPath, extensions, existingState.tracks));
    }
    return scannedFolders;
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
