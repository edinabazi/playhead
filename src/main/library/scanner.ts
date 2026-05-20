import { readdir, stat } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { parseFile } from "music-metadata";
import type {
  LibraryArtwork,
  LibraryFolder,
  LibraryState,
  LibraryTrack,
  ScannedFolder,
} from "../../shared/library";
import {
  getArtwork,
  getAvailableArtwork,
  getContentAddressedArtwork,
  getStoredArtwork,
} from "../artwork";
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
const maxVisitedDirectories = 5_000;
const maxVisitedEntries = 75_000;
const metadataParseConcurrency = 4;

type BuildTrackOptions = {
  reuseStoredArtwork?: boolean;
  existingTracks?: LibraryState["tracks"];
  artworkCache?: Map<string, Promise<LibraryArtwork | undefined>>;
};

function normalizeExtensions(extensions?: string[]): Set<string> {
  if (!extensions || extensions.length === 0) return audioExtensions;
  return new Set(extensions.map((extension) => extension.toLowerCase()));
}

async function findAudioFiles(folderPath: string, extensions = audioExtensions): Promise<string[]> {
  const audioFiles: string[] = [];
  const pendingDirectories = [folderPath];
  let visitedDirectories = 0;
  let visitedEntries = 0;

  while (pendingDirectories.length > 0) {
    const currentDirectory = pendingDirectories.pop();
    if (!currentDirectory) continue;

    visitedDirectories += 1;
    if (visitedDirectories > maxVisitedDirectories) {
      throw new Error("That folder is too broad to scan. Choose a dedicated music folder instead.");
    }

    let entries;
    try {
      entries = await readdir(currentDirectory, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      visitedEntries += 1;
      if (visitedEntries > maxVisitedEntries) {
        throw new Error(
          "That folder contains too many files to scan safely. Choose a dedicated music folder instead.",
        );
      }

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
      }
    }
  }

  return audioFiles.sort((a, b) => a.localeCompare(b));
}

async function buildTracksWithConcurrency(
  filePaths: string[],
  folderId: string,
  options: BuildTrackOptions = {},
): Promise<LibraryTrack[]> {
  const tracks = new Array<LibraryTrack>(filePaths.length);
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(metadataParseConcurrency, filePaths.length) },
    async () => {
      while (nextIndex < filePaths.length) {
        const index = nextIndex;
        nextIndex += 1;
        tracks[index] = await buildTrack(filePaths[index], folderId, options);
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

  try {
    const trackId = makeId(filePath);
    const storedArtwork = options.reuseStoredArtwork
      ? (await getAvailableArtwork(options.existingTracks?.[trackId]?.artwork)) ||
        (await getStoredArtwork(trackId))
      : undefined;
    const metadata = await parseFile(filePath, {
      duration: true,
      skipCovers: Boolean(storedArtwork),
    });

    const bpm = metadata.common.bpm;
    const artwork =
      storedArtwork ||
      (options.artworkCache
        ? await getContentAddressedArtwork(metadata.common.picture, options.artworkCache)
        : await getArtwork(trackId, metadata.common.picture));

    return {
      id: trackId,
      path: filePath,
      fileName,
      title: metadata.common.title || cleanTitle(filePath),
      artist: metadata.common.artist || "Unknown Artist",
      album: metadata.common.album,
      albumArtist: metadata.common.albumartist,
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
  } catch {
    return {
      id: makeId(filePath),
      path: filePath,
      fileName,
      title: cleanTitle(filePath),
      artist: "Unknown Artist",
      duration: 0,
      folderId,
    };
  }
}

export async function scanFolderPath(
  folderPath: string,
  extensions?: string[],
  existingTracks: LibraryState["tracks"] = {},
): Promise<ScannedFolder> {
  const folderInfo = await stat(folderPath);
  if (!folderInfo.isDirectory()) throw new Error("Selected path is not a folder.");

  const folder: LibraryFolder = {
    id: makeId(folderPath),
    name: basename(folderPath),
    path: folderPath,
    trackIds: [],
  };

  const audioFiles = await findAudioFiles(folderPath, normalizeExtensions(extensions));
  const tracks = await buildTracksWithConcurrency(audioFiles, folder.id, {
    reuseStoredArtwork: true,
    existingTracks,
    artworkCache: new Map(),
  });
  folder.trackIds = tracks.map((track) => track.id);

  return { folder, tracks };
}
