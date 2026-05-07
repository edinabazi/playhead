import { readdir, stat } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { parseFile } from "music-metadata";
import type { LibraryFolder, LibraryTrack, ScannedFolder } from "../../shared/library";
import { getArtwork } from "../artwork";
import { audioExtensions } from "./constants";
import { cleanTitle, makeId } from "./ids";

function normalizeExtensions(extensions?: string[]): Set<string> {
  if (!extensions || extensions.length === 0) return audioExtensions;
  return new Set(extensions.map((extension) => extension.toLowerCase()));
}

async function findAudioFiles(folderPath: string, extensions = audioExtensions): Promise<string[]> {
  const entries = await readdir(folderPath, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = join(folderPath, entry.name);

      if (entry.isDirectory()) return findAudioFiles(entryPath, extensions);
      if (entry.isFile() && extensions.has(extname(entry.name).toLowerCase())) return [entryPath];

      return [];
    }),
  );

  return files.flat().sort((a, b) => a.localeCompare(b));
}

export async function buildTrack(filePath: string, folderId: string): Promise<LibraryTrack> {
  const fileName = basename(filePath);

  try {
    const trackId = makeId(filePath);
    const metadata = await parseFile(filePath, { duration: true });

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
      artwork: await getArtwork(trackId, metadata.common.picture),
      duration: metadata.format.duration || 0,
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
  const tracks = await Promise.all(audioFiles.map((filePath) => buildTrack(filePath, folder.id)));
  folder.trackIds = tracks.map((track) => track.id);

  return { folder, tracks };
}
