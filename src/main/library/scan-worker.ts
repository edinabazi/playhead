import { parentPort, workerData } from "node:worker_threads";
import { createHash } from "node:crypto";
import { stat } from "node:fs/promises";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { LibraryArtwork, LibraryState, ScannedFolder } from "../../shared/library";
import type { LibraryScanProgress } from "../../shared/library-scan";
import { scanFolderPath, type ScanArtwork } from "./scanner";

export type ScanWorkerData = {
  id: string;
  paths: string[];
  extensions?: string[];
  existingTracks: LibraryState["tracks"];
  artworkDirectory: string;
};
export type ScanWorkerMessage =
  | { type: "progress"; progress: LibraryScanProgress }
  | { type: "artwork"; id: number; key: string; bytes: Uint8Array }
  | { type: "complete"; folders: ScannedFolder[] }
  | { type: "error"; message: string };
export type ArtworkReply = { id: number; artwork?: LibraryArtwork; error?: string };

const port = parentPort!;
const data = workerData as ScanWorkerData;
let artworkId = 0;
const pendingArtwork = new Map<
  number,
  { resolve: (artwork?: LibraryArtwork) => void; reject: (error: Error) => void }
>();
port.on("message", (reply: ArtworkReply) => {
  const pending = pendingArtwork.get(reply.id);
  if (!pending) return;
  pendingArtwork.delete(reply.id);
  if (reply.error) pending.reject(new Error(reply.error));
  else pending.resolve(reply.artwork);
});
const send = (message: ScanWorkerMessage) => port.postMessage(message);
const storeArtwork = (key: string, bytes: Uint8Array): Promise<LibraryArtwork | undefined> =>
  new Promise((resolve, reject) => {
    const id = ++artworkId;
    pendingArtwork.set(id, { resolve, reject });
    send({ type: "artwork", id, key, bytes });
  });
async function available(artwork?: LibraryArtwork): Promise<LibraryArtwork | undefined> {
  if (!artwork?.src) return undefined;
  try {
    const path = artwork.src.startsWith("playhead-artwork://")
      ? Buffer.from(new URL(artwork.src).pathname.slice(1), "base64url").toString("utf8")
      : fileURLToPath(artwork.src);
    return (await stat(path)).isFile() ? artwork : undefined;
  } catch {
    return undefined;
  }
}
const artwork: ScanArtwork = {
  getAvailableArtwork: available,
  getStoredArtwork: (id) =>
    available({
      mimeType: "image/png",
      src: `playhead-artwork://image/${Buffer.from(join(data.artworkDirectory, `${id}.png`)).toString("base64url")}`,
    }),
  getArtwork: (id, pictures) =>
    pictures?.[0] ? storeArtwork(id, pictures[0].data) : Promise.resolve(undefined),
  getContentAddressedArtwork: (pictures, cache) => {
    const picture = pictures?.[0];
    if (!picture) return Promise.resolve(undefined);
    const key = `cover-${createHash("sha1").update(picture.data).digest("hex")}`;
    const cached = cache.get(key);
    if (cached) return cached;
    const pending = available({
      mimeType: "image/png",
      src: `playhead-artwork://image/${Buffer.from(join(data.artworkDirectory, `${key}.png`)).toString("base64url")}`,
    }).then((existing) => existing || storeArtwork(key, picture.data));
    cache.set(key, pending);
    return pending;
  },
};

async function run() {
  const folders: ScannedFolder[] = [];
  for (const [index, path] of data.paths.entries()) {
    folders.push(
      await scanFolderPath(path, data.extensions, data.existingTracks, {
        artwork,
        onProgress: (progress) =>
          send({
            type: "progress",
            progress: {
              ...progress,
              id: data.id,
              folderName: basename(path),
              folderIndex: index + 1,
              folderCount: data.paths.length,
            },
          }),
      }),
    );
  }
  send({ type: "complete", folders });
}
void run()
  .catch((error: unknown) => {
    const code = (error as NodeJS.ErrnoException)?.code;
    send({
      type: "error",
      message: code
        ? "Couldn't read the music folder. Check the drive connection and folder permissions, then try again. Your library hasn't changed."
        : error instanceof Error
          ? error.message
          : "Could not scan this folder.",
    });
  })
  .finally(() => port.close());
