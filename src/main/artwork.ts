import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";
import { app, nativeImage } from "electron";
import type { LibraryArtwork, LibraryState } from "../shared/library";

export async function writeArtwork(trackId: string, bytes: Uint8Array): Promise<LibraryArtwork> {
  const image = nativeImage.createFromBuffer(Buffer.from(bytes));
  const normalized = image.isEmpty() ? Buffer.from(bytes) : image.resize({ width: 512 }).toPNG();
  const mimeType = "image/png";
  const artworkDirectory = join(app.getPath("userData"), "artwork");
  const artworkPath = join(artworkDirectory, `${trackId}.png`);

  await mkdir(artworkDirectory, { recursive: true });
  await writeFile(artworkPath, normalized);

  return {
    mimeType,
    src: pathToFileURL(artworkPath).toString(),
    dataUrl: `data:${mimeType};base64,${normalized.toString("base64")}`,
  };
}

export async function getArtwork(
  trackId: string,
  pictures: { format: string; data: Uint8Array }[] | undefined,
): Promise<LibraryArtwork | undefined> {
  const picture = pictures?.[0];
  if (!picture) return undefined;

  return writeArtwork(trackId, picture.data);
}

export async function materializeStoredArtwork(state: LibraryState): Promise<LibraryState> {
  let changed = false;
  const nextTracks: LibraryState["tracks"] = {};

  for (const [trackId, track] of Object.entries(state.tracks)) {
    if (
      track.artwork?.mimeType === "image/png" &&
      track.artwork.src?.endsWith(".png") &&
      track.artwork.dataUrl?.startsWith("data:image/png;base64,")
    ) {
      nextTracks[trackId] = track;
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
        const bytes = await readFile(fileURLToPath(track.artwork.src));
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
