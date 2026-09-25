import type { Stats } from "node:fs";
import { opendir, stat } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { parseFile } from "music-metadata";
import { libraryTrackMetadataVersion } from "../../shared/library";
import { getDiscMetadata } from "../metadata/disc";
import type {
  LibraryArtwork,
  LibraryFolder,
  LibraryState,
  LibraryTrack,
  ScannedFolder,
} from "../../shared/library";
import type { ScanProgress } from "../../shared/library-scan";
import { audioExtensions } from "./constants";
import { cleanTitle, makeId } from "./ids";

const ignoredDirectoryNames = new Set([
  ".cache",
  ".next",
  ".nuxt",
  ".output",
  ".parcel-cache",
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
const blockedDirectoryNames = new Set([
  ".git",
  ".hg",
  ".svn",
  "bower_components",
  "node_modules",
  "vendor",
]);
const blockedFileNames = new Set([
  "bun.lock",
  "Cargo.toml",
  "composer.json",
  "go.mod",
  "package-lock.json",
  "package.json",
  "pyproject.toml",
  "requirements.txt",
  "yarn.lock",
]);
const directoryReadConcurrency = 8;
const metadataParseConcurrency = 4;

export type ScanArtwork = Pick<
  typeof import("../artwork"),
  "getArtwork" | "getAvailableArtwork" | "getContentAddressedArtwork" | "getStoredArtwork"
>;
export type ScanOptions = {
  signal?: AbortSignal;
  onProgress?: (progress: ScanProgress) => void;
  artwork?: ScanArtwork;
};
type BuildTrackOptions = {
  reuseStoredArtwork?: boolean;
  existingTracks?: LibraryState["tracks"];
  artworkCache?: Map<string, Promise<LibraryArtwork | undefined>>;
} & ScanOptions;

function normalizeExtensions(extensions?: string[]): Set<string> {
  if (!extensions || extensions.length === 0) return audioExtensions;
  return new Set(extensions.map((extension) => extension.toLowerCase()));
}

async function findAudioFiles(
  folderPath: string,
  extensions: Set<string>,
  options: ScanOptions,
  progress: ScanProgress,
  report: (force?: boolean) => void,
): Promise<string[]> {
  const audioFiles: string[] = [];
  const pendingDirectories = [folderPath];

  while (pendingDirectories.length > 0) {
    options.signal?.throwIfAborted();
    const directoryBatch = pendingDirectories.splice(-directoryReadConcurrency);
    await Promise.all(
      directoryBatch.map(async (currentDirectory) => {
        // Stream directory entries instead of allocating an entire NAS directory at once.
        // Do not swallow read errors: an incomplete rescan must never look successful.
        const directory = await opendir(currentDirectory, { bufferSize: 128 });
        for await (const entry of directory) {
          options.signal?.throwIfAborted();
          const entryPath = join(currentDirectory, entry.name);

          if (entry.isDirectory()) {
            if (blockedDirectoryNames.has(entry.name)) {
              throw new Error(
                "That looks like a code folder. Choose a dedicated music folder instead.",
              );
            }
            if (!ignoredDirectoryNames.has(entry.name)) pendingDirectories.push(entryPath);
            continue;
          }

          if (entry.isFile() && blockedFileNames.has(entry.name)) {
            throw new Error(
              "That looks like a project folder. Choose a dedicated music folder instead.",
            );
          }

          if (entry.isFile() && extensions.has(extname(entry.name).toLowerCase())) {
            audioFiles.push(entryPath);
            progress.discovered++;
          }
          report();
        }
        progress.directories++;
        report();
      }),
    );
  }

  return audioFiles.sort((a, b) => a.localeCompare(b));
}

async function buildTracksWithConcurrency(
  filePaths: string[],
  folderId: string,
  options: BuildTrackOptions = {},
  onProcessed?: () => void,
): Promise<LibraryTrack[]> {
  const tracks = new Array<LibraryTrack>(filePaths.length);
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(metadataParseConcurrency, filePaths.length) },
    async () => {
      while (nextIndex < filePaths.length) {
        options.signal?.throwIfAborted();
        const index = nextIndex;
        nextIndex += 1;
        tracks[index] = await buildTrack(filePaths[index], folderId, options);
        onProcessed?.();
      }
    },
  );

  await Promise.all(workers);
  return tracks;
}

export async function buildTrack(
  filePath: string,
  folderId: string,
  options: BuildTrackOptions = {},
): Promise<LibraryTrack> {
  const fileName = basename(filePath);
  const trackId = makeId(filePath);
  let fileInfo: Stats | undefined;

  try {
    options.signal?.throwIfAborted();
    fileInfo = await stat(filePath);
    options.signal?.throwIfAborted();
    const existingTrack = options.existingTracks?.[trackId];
    if (
      existingTrack?.path === filePath &&
      existingTrack.metadataVersion === libraryTrackMetadataVersion &&
      existingTrack.fileSize === fileInfo.size &&
      Math.trunc(existingTrack.fileModifiedAt || 0) === Math.trunc(fileInfo.mtimeMs)
    ) {
      return existingTrack.folderId === folderId ? existingTrack : { ...existingTrack, folderId };
    }

    const artworkApi = options.artwork || (await import("../artwork"));
    const storedArtwork = options.reuseStoredArtwork
      ? (await artworkApi.getAvailableArtwork(options.existingTracks?.[trackId]?.artwork)) ||
        (await artworkApi.getStoredArtwork(trackId))
      : undefined;
    const metadata = await parseFile(filePath, {
      duration: true,
      skipCovers: Boolean(storedArtwork),
    });

    const bpm = metadata.common.bpm;
    const artwork =
      storedArtwork ||
      (options.artworkCache
        ? await artworkApi.getContentAddressedArtwork(metadata.common.picture, options.artworkCache)
        : await artworkApi.getArtwork(trackId, metadata.common.picture));

    return {
      id: trackId,
      path: filePath,
      fileName,
      fileSize: fileInfo.size,
      fileModifiedAt: fileInfo.mtimeMs,
      title: metadata.common.title || cleanTitle(filePath),
      artist: metadata.common.artist || "Unknown Artist",
      album: metadata.common.album,
      albumArtist: metadata.common.albumartist,
      genre: metadata.common.genre?.join(", "),
      composer: metadata.common.composer?.join(", "),
      disc: getDiscMetadata(metadata),
      metadataVersion: libraryTrackMetadataVersion,
      trackNumber: metadata.common.track.no || undefined,
      diskNumber: metadata.common.disk.no || undefined,
      year: metadata.common.year,
      artwork,
      duration: metadata.format.duration || 0,
      audioFormat: metadata.format.container || extname(filePath).slice(1).toUpperCase(),
      sampleRate: metadata.format.sampleRate,
      bitRate: metadata.format.bitrate,
      bpm,
      bpmSource: bpm ? "metadata" : undefined,
      folderId,
    };
  } catch (error) {
    options.signal?.throwIfAborted();
    // Keep the last known metadata when a previously imported file cannot be read.
    const existing = options.existingTracks?.[trackId];
    if (existing) return { ...existing, folderId };
    if (
      (error as NodeJS.ErrnoException)?.code &&
      !(error as NodeJS.ErrnoException).code?.startsWith("ERR_")
    )
      throw error;
    return {
      id: trackId,
      path: filePath,
      fileName,
      fileSize: fileInfo?.size,
      fileModifiedAt: fileInfo?.mtimeMs,
      title: cleanTitle(filePath),
      artist: "Unknown Artist",
      metadataVersion: libraryTrackMetadataVersion,
      duration: 0,
      folderId,
    };
  }
}

export async function scanFolderPath(
  folderPath: string,
  extensions?: string[],
  existingTracks: LibraryState["tracks"] = {},
  options: ScanOptions = {},
): Promise<ScannedFolder> {
  options.signal?.throwIfAborted();
  const folderInfo = await stat(folderPath);
  if (!folderInfo.isDirectory()) throw new Error("Selected path is not a folder.");

  const folder: LibraryFolder = {
    id: makeId(folderPath),
    name: basename(folderPath),
    path: folderPath,
    trackIds: [],
    metadataVersion: libraryTrackMetadataVersion,
  };

  const progress: ScanProgress = {
    phase: "discovering",
    discovered: 0,
    processed: 0,
    directories: 0,
  };
  let lastReport = 0;
  const report = (force = false) => {
    const now = Date.now();
    if (!force && now - lastReport < 200) return;
    lastReport = now;
    options.onProgress?.({ ...progress });
  };
  report(true);
  const audioFiles = await findAudioFiles(
    folderPath,
    normalizeExtensions(extensions),
    options,
    progress,
    report,
  );
  progress.phase = "reading";
  report(true);
  const tracks = await buildTracksWithConcurrency(
    audioFiles,
    folder.id,
    {
      ...options,
      reuseStoredArtwork: true,
      existingTracks,
      artworkCache: new Map(),
    },
    () => {
      progress.processed++;
      report();
    },
  );
  options.signal?.throwIfAborted();
  report(true);
  folder.trackIds = tracks.map((track) => track.id);

  return { folder, tracks };
}
