import { mkdir, readdir, readFile, rm, stat, utimes, writeFile } from "node:fs/promises";
import type { Stats } from "node:fs";
import { join } from "node:path";
import type {
  WaveformCacheEntry,
  WaveformCacheRequest,
  WaveformCacheWrite,
} from "../../shared/library";

const cacheVersion = 1;
const waveformExtension = ".wf";
const waveformMagic = Buffer.from("PHWF1\n", "ascii");

export const waveformCachePeakRate = 20;
export const waveformCacheMaxPeaks = 24_000;
export const waveformCacheChannels = 1;
export const waveformCacheMaxBytes = 256 * 1024 * 1024;

type WaveformCacheOptions = {
  directory: string;
  maxBytes?: number;
};

type WaveformCacheHeader = {
  version: number;
  size: number;
  mtimeMs: number;
  duration: number;
  channels: number;
  peakRate: number;
  maxPeaks: number;
  peakCount: number;
};

function cachePath(directory: string, trackId: string): string {
  return join(directory, `${encodeURIComponent(trackId)}${waveformExtension}`);
}

function sanitizeDuration(duration: number): number {
  return Number.isFinite(duration) && duration > 0 ? duration : 0;
}

function getExpectedPeakCount(duration: number): number {
  return Math.max(1, Math.min(waveformCacheMaxPeaks, Math.ceil(duration * waveformCachePeakRate)));
}

function quantizePeak(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-127, Math.min(127, Math.round(Math.max(-1, Math.min(1, value)) * 127)));
}

export function getWaveformCachePeakCount(duration: number): number {
  return getExpectedPeakCount(sanitizeDuration(duration));
}

export function encodeWaveformCache(
  header: WaveformCacheHeader,
  peaks: number[][],
): Buffer {
  const peakCount = getExpectedPeakCount(header.duration);
  const payload = Buffer.alloc(header.channels * peakCount);

  for (let channelIndex = 0; channelIndex < header.channels; channelIndex += 1) {
    const channel = peaks[channelIndex] || [];
    for (let peakIndex = 0; peakIndex < peakCount; peakIndex += 1) {
      payload.writeInt8(quantizePeak(channel[peakIndex] ?? 0), channelIndex * peakCount + peakIndex);
    }
  }

  const normalizedHeader: WaveformCacheHeader = {
    ...header,
    version: cacheVersion,
    channels: waveformCacheChannels,
    peakRate: waveformCachePeakRate,
    maxPeaks: waveformCacheMaxPeaks,
    peakCount,
  };
  const headerBytes = Buffer.from(`${JSON.stringify(normalizedHeader)}\n`, "utf8");

  return Buffer.concat([waveformMagic, headerBytes, payload]);
}

export function decodeWaveformCache(bytes: Buffer): {
  header: WaveformCacheHeader;
  entry: WaveformCacheEntry;
} | null {
  if (!bytes.subarray(0, waveformMagic.length).equals(waveformMagic)) return null;

  const headerEnd = bytes.indexOf("\n", waveformMagic.length);
  if (headerEnd === -1) return null;

  let header: WaveformCacheHeader;
  try {
    header = JSON.parse(bytes.subarray(waveformMagic.length, headerEnd).toString("utf8"));
  } catch {
    return null;
  }

  if (
    header.version !== cacheVersion ||
    header.channels !== waveformCacheChannels ||
    header.peakRate !== waveformCachePeakRate ||
    header.maxPeaks !== waveformCacheMaxPeaks ||
    !Number.isFinite(header.duration) ||
    header.duration <= 0 ||
    !Number.isInteger(header.peakCount) ||
    header.peakCount <= 0
  ) {
    return null;
  }

  const payload = bytes.subarray(headerEnd + 1);
  if (payload.length !== header.channels * header.peakCount) return null;

  const peaks = Array.from({ length: header.channels }, (_, channelIndex) => {
    const channel: number[] = [];
    for (let peakIndex = 0; peakIndex < header.peakCount; peakIndex += 1) {
      channel.push(payload.readInt8(channelIndex * header.peakCount + peakIndex) / 127);
    }
    return channel;
  });

  return { header, entry: { duration: header.duration, peaks } };
}

function isValidHeader(header: WaveformCacheHeader, source: Stats): boolean {
  return (
    header.size === source.size &&
    Math.trunc(header.mtimeMs) === Math.trunc(source.mtimeMs) &&
    header.channels === waveformCacheChannels &&
    header.peakRate === waveformCachePeakRate &&
    header.maxPeaks === waveformCacheMaxPeaks
  );
}

export async function readWaveformCache(
  request: WaveformCacheRequest,
  options: WaveformCacheOptions,
): Promise<WaveformCacheEntry | null> {
  const filePath = cachePath(options.directory, request.trackId);

  try {
    const [source, bytes] = await Promise.all([stat(request.path), readFile(filePath)]);
    const decoded = decodeWaveformCache(bytes);
    if (!decoded || !isValidHeader(decoded.header, source)) return null;

    const now = new Date();
    await utimes(filePath, now, now);
    return decoded.entry;
  } catch {
    return null;
  }
}

export async function writeWaveformCache(
  write: WaveformCacheWrite,
  options: WaveformCacheOptions,
): Promise<void> {
  const duration = sanitizeDuration(write.duration);
  if (duration <= 0 || write.peaks.length === 0) return;

  const source = await stat(write.path);
  const header: WaveformCacheHeader = {
    version: cacheVersion,
    size: source.size,
    mtimeMs: source.mtimeMs,
    duration,
    channels: waveformCacheChannels,
    peakRate: waveformCachePeakRate,
    maxPeaks: waveformCacheMaxPeaks,
    peakCount: getExpectedPeakCount(duration),
  };

  await mkdir(options.directory, { recursive: true });
  await writeFile(cachePath(options.directory, write.trackId), encodeWaveformCache(header, write.peaks));
  await pruneWaveformCache(options);
}

export async function pruneWaveformCache(options: WaveformCacheOptions): Promise<void> {
  const maxBytes = options.maxBytes ?? waveformCacheMaxBytes;
  let entries;

  try {
    entries = await readdir(options.directory, { withFileTypes: true });
  } catch {
    return;
  }

  const files = (
    await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(waveformExtension))
        .map(async (entry) => {
          const path = join(options.directory, entry.name);
          const fileInfo = await stat(path);
          return { path, size: fileInfo.size, mtimeMs: fileInfo.mtimeMs };
        }),
    )
  ).sort((a, b) => a.mtimeMs - b.mtimeMs);
  let totalSize = files.reduce((total, file) => total + file.size, 0);

  for (const file of files) {
    if (totalSize <= maxBytes) break;
    await rm(file.path, { force: true });
    totalSize -= file.size;
  }
}
