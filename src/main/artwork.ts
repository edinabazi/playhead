import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import type { LibraryArtwork, LibraryState } from "../shared/library";
import { electron } from "./electron";

const { app, nativeImage } = electron;
const artworkMimeType = "image/png";

function getArtworkDirectory(): string {
  return join(app.getPath("userData"), "artwork");
}

function getArtworkPath(key: string): string {
  return join(getArtworkDirectory(), `${key}.png`);
}

export function encodeArtworkPath(filePath: string): string {
  return Buffer.from(filePath, "utf8").toString("base64url");
}

export function decodeArtworkPath(url: string): string {
  const encodedPath = new URL(url).pathname.slice(1);
  return Buffer.from(encodedPath, "base64url").toString("utf8");
}

export function artworkUrlFromPath(filePath: string): string {
  return `playhead-artwork://image/${encodeArtworkPath(filePath)}`;
}

function artworkPathFromUrl(src: string): string {
  if (src.startsWith("playhead-artwork://")) return decodeArtworkPath(src);
  return fileURLToPath(src);
}

async function writeArtworkFile(key: string, bytes: Uint8Array): Promise<LibraryArtwork> {
  const image = nativeImage.createFromBuffer(Buffer.from(bytes));
  const normalized = image.isEmpty() ? Buffer.from(bytes) : image.resize({ width: 512 }).toPNG();
  const artworkDirectory = getArtworkDirectory();
  const artworkPath = getArtworkPath(key);

  await mkdir(artworkDirectory, { recursive: true });
  await writeFile(artworkPath, normalized);

  return {
    mimeType: artworkMimeType,
    src: artworkUrlFromPath(artworkPath),
  };
}

export async function getStoredArtwork(trackId: string): Promise<LibraryArtwork | undefined> {
  const artworkPath = getArtworkPath(trackId);

  try {
    const fileInfo = await stat(artworkPath);
    if (!fileInfo.isFile()) return undefined;
    return {
      mimeType: artworkMimeType,
      src: artworkUrlFromPath(artworkPath),
    };
  } catch {
    return undefined;
  }
}

export async function getAvailableArtwork(
  artwork: LibraryArtwork | undefined,
): Promise<LibraryArtwork | undefined> {
  if (!artwork?.src) return undefined;

  try {
    const fileInfo = await stat(artworkPathFromUrl(artwork.src));
    if (!fileInfo.isFile()) return undefined;
    return {
      mimeType: artwork.mimeType,
      src: artwork.src,
    };
  } catch {
    return undefined;
  }
}

export async function writeArtwork(trackId: string, bytes: Uint8Array): Promise<LibraryArtwork> {
  return writeArtworkFile(trackId, bytes);
}

export async function getArtwork(
  trackId: string,
  pictures: { format: string; data: Uint8Array }[] | undefined,
): Promise<LibraryArtwork | undefined> {
  const picture = pictures?.[0];
  if (!picture) return undefined;

  return writeArtwork(trackId, picture.data);
}

export async function getContentAddressedArtwork(
  pictures: { format: string; data: Uint8Array }[] | undefined,
  cache: Map<string, Promise<LibraryArtwork | undefined>>,
): Promise<LibraryArtwork | undefined> {
  const picture = pictures?.[0];
  if (!picture) return undefined;

  const hash = createHash("sha1").update(picture.data).digest("hex");
  const key = `cover-${hash}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const write = writeArtworkFile(key, picture.data).catch((error) => {
    cache.delete(key);
    throw error;
  });
  cache.set(key, write);
  return write;
}

export async function materializeStoredArtwork(state: LibraryState): Promise<LibraryState> {
  let changed = false;
  const nextTracks: LibraryState["tracks"] = {};

  for (const [trackId, track] of Object.entries(state.tracks)) {
    if (track.artwork?.src?.startsWith("playhead-artwork://")) {
      nextTracks[trackId] = track.artwork.dataUrl
        ? { ...track, artwork: { mimeType: track.artwork.mimeType, src: track.artwork.src } }
        : track;
      if (track.artwork.dataUrl) changed = true;
      continue;
    }

    if (track.artwork?.mimeType === "image/png" && track.artwork.src?.startsWith("file://")) {
      nextTracks[trackId] = {
        ...track,
        artwork: {
          mimeType: track.artwork.mimeType,
          src: artworkUrlFromPath(fileURLToPath(track.artwork.src)),
        },
      };
      changed = true;
      continue;
    }

    if (track.artwork?.dataUrl) {
      const match = /^data:.+;base64,(.+)$/.exec(track.artwork.dataUrl);
      if (!match) {
        nextTracks[trackId] = track;
        continue;
      }

      nextTracks[trackId] = {
        ...track,
        artwork: await writeArtwork(trackId, Buffer.from(match[1], "base64")),
      };
      changed = true;
      continue;
    }

    if (track.artwork?.src) {
      try {
        const bytes = await readFile(artworkPathFromUrl(track.artwork.src));
        nextTracks[trackId] = {
          ...track,
          artwork: await writeArtwork(trackId, bytes),
        };
        changed = true;
        continue;
      } catch {
        nextTracks[trackId] = track;
        continue;
      }
    }

    if (!track.artwork?.dataUrl) {
      nextTracks[trackId] = track;
      continue;
    }
  }

  if (!changed) return state;
  const nextState = { ...state, tracks: nextTracks };
  return nextState;
}
