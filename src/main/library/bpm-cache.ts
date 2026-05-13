import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Stats } from "node:fs";
import type { BpmCacheEntry, BpmCacheRequest, BpmCacheWrite } from "../../shared/library";

const cacheVersion = 1;
const bpmExtension = ".bpm.json";

type BpmCacheOptions = {
  directory: string;
};

type StoredBpmCacheEntry = BpmCacheEntry & {
  version: number;
  size: number;
  mtimeMs: number;
};

function cachePath(directory: string, trackId: string): string {
  return join(directory, `${encodeURIComponent(trackId)}${bpmExtension}`);
}

function isValidBpm(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function isValidEntry(entry: StoredBpmCacheEntry, source: Stats): boolean {
  return (
    entry.version === cacheVersion &&
    entry.size === source.size &&
    Math.trunc(entry.mtimeMs) === Math.trunc(source.mtimeMs) &&
    isValidBpm(entry.bpm) &&
    isValidBpm(entry.tempo) &&
    Boolean(entry.analyzedAt)
  );
}

export async function readBpmCache(
  request: BpmCacheRequest,
  options: BpmCacheOptions,
): Promise<BpmCacheEntry | null> {
  try {
    const [source, raw] = await Promise.all([
      stat(request.path),
      readFile(cachePath(options.directory, request.trackId), "utf8"),
    ]);
    const entry = JSON.parse(raw) as StoredBpmCacheEntry;
    if (!isValidEntry(entry, source)) return null;

    return {
      bpm: entry.bpm,
      tempo: entry.tempo,
      analyzedAt: entry.analyzedAt,
    };
  } catch {
    return null;
  }
}

export async function writeBpmCache(
  write: BpmCacheWrite,
  options: BpmCacheOptions,
): Promise<void> {
  if (!isValidBpm(write.bpm) || !isValidBpm(write.tempo)) return;

  const source = await stat(write.path);
  const entry: StoredBpmCacheEntry = {
    version: cacheVersion,
    size: source.size,
    mtimeMs: source.mtimeMs,
    bpm: write.bpm,
    tempo: write.tempo,
    analyzedAt: write.analyzedAt,
  };

  await mkdir(options.directory, { recursive: true });
  await writeFile(cachePath(options.directory, write.trackId), `${JSON.stringify(entry)}\n`, "utf8");
}
