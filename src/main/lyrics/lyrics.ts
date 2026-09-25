import { readFile, readdir, stat } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { parseFile, type IAudioMetadata } from "music-metadata";
import {
  normalizeTimedLyrics,
  parseLyrics,
  type Lyrics,
  type TrackLyrics,
} from "../../shared/lyrics";

export function sidecarName(audioPath: string): string {
  return `${basename(audioPath, extname(audioPath))}.lrc`;
}

export async function readLyricsFile(filePath: string): Promise<Lyrics> {
  if (extname(filePath).toLowerCase() !== ".lrc") throw new Error("Choose an .lrc lyrics file.");
  const info = await stat(filePath);
  if (!info.isFile() || info.size > 1024 * 1024)
    throw new Error("Choose a lyrics file smaller than 1 MB.");
  const buffer = await readFile(filePath);
  // UTF-8 is standard; BOM-marked UTF-16 exports are common in older libraries.
  const encoding =
    buffer[0] === 0xff && buffer[1] === 0xfe
      ? "utf-16le"
      : buffer[0] === 0xfe && buffer[1] === 0xff
        ? "utf-16be"
        : "utf-8";
  let text: string;
  try {
    text = new TextDecoder(encoding, { fatal: true }).decode(buffer);
  } catch {
    throw new Error("Save this lyrics file as UTF-8 or UTF-16 and try again.");
  }
  const lyrics = parseLyrics(text);
  if (!lyrics) throw new Error("This file doesn't contain any readable lyrics.");
  return lyrics;
}

export function embeddedLyrics(metadata: IAudioMetadata): Lyrics | null {
  const candidates: Lyrics[] = [];
  // Read original text tags first: the library's LRC normalization drops offsets and repeated timestamps.
  for (const tags of Object.values(metadata.native)) {
    for (const tag of tags) {
      if (!/^(USLT|ULT|LYRICS|UNSYNCEDLYRICS|©lyr)$/i.test(tag.id)) continue;
      const text =
        typeof tag.value === "string" ? tag.value : (tag.value as { text?: unknown } | null)?.text;
      if (typeof text === "string") {
        const parsed = parseLyrics(text);
        if (parsed) candidates.push(parsed);
      }
    }
  }
  const rawSynced = candidates.find((item) => item.synced);
  if (rawSynced) return rawSynced;
  for (const tag of metadata.common.lyrics ?? []) {
    if (tag.timeStampFormat === 2 && tag.syncText?.length) {
      const parsed = normalizeTimedLyrics(
        tag.syncText.map((line) => ({
          time: line.timestamp === undefined ? null : line.timestamp / 1000,
          text: line.text.trim(),
        })),
      );
      if (parsed.lines.some((line) => line.text)) candidates.push(parsed);
    } else {
      // MPEG-frame timestamps cannot safely be treated as milliseconds. Still show their text.
      const parsed = parseLyrics(
        tag.text || tag.syncText?.map((line) => line.text).join("\n") || "",
      );
      if (parsed) candidates.push(parsed);
    }
  }
  return candidates.find((item) => item.synced) ?? candidates[0] ?? null;
}

export async function loadTrackLyrics(
  audioPath: string,
  selectedFile?: string,
): Promise<TrackLyrics> {
  let filePath = selectedFile;
  if (!filePath) {
    const expected = sidecarName(audioPath).toLowerCase();
    const files = await readdir(dirname(audioPath));
    const match =
      files.find((name) => name === sidecarName(audioPath)) ??
      files.find((name) => name.toLowerCase() === expected);
    if (match) filePath = join(dirname(audioPath), match);
  }
  if (filePath) {
    try {
      return {
        lyrics: await readLyricsFile(filePath),
        source: "file",
        fileName: basename(filePath),
        custom: Boolean(selectedFile),
      };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      return {
        lyrics: null,
        source: "file",
        fileName: basename(filePath),
        custom: Boolean(selectedFile),
        error:
          code === "ENOENT"
            ? "This lyrics file has moved or been removed. Choose it again or use automatic lyrics."
            : error instanceof Error && !code
              ? error.message
              : "Couldn't read this lyrics file. Check its permissions or choose another file.",
      };
    }
  }
  const metadata = await parseFile(audioPath, { skipCovers: true, duration: false });
  const lyrics = embeddedLyrics(metadata);
  return { lyrics, source: lyrics ? "embedded" : null, custom: false };
}
