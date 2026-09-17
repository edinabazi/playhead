import type { AudioFileRevision, LibraryTrack } from "../../../../shared/library";
import { decodeAudioBytes, decodeAudioTrack, getLoudnessNormalizationGain } from "./audio-analysis";
import { analyzeLoudnessOffThread } from "./loudness-worker-client";

const normalizationCacheStorageKey = "playhead:volume-normalization-cache:v2";
const normalizationCacheLimit = 2_000;

type CachedNormalization = {
  gain: number;
  loudnessDb: number;
  analyzedAt: number;
};

type NormalizationCache = Record<string, CachedNormalization>;

let normalizationCache: NormalizationCache | null = null;
let analysisQueue: Promise<void> = Promise.resolve();

function getNormalizationCache(): NormalizationCache {
  if (normalizationCache) return normalizationCache;
  normalizationCache = {};
  if (typeof localStorage === "undefined") return normalizationCache;

  try {
    const raw = localStorage.getItem(normalizationCacheStorageKey);
    if (!raw) return normalizationCache;
    const parsed = JSON.parse(raw) as NormalizationCache;
    if (parsed && typeof parsed === "object") normalizationCache = parsed;
  } catch {
    normalizationCache = {};
  }

  return normalizationCache;
}

export function buildTrackNormalizationCacheKey(
  track: LibraryTrack,
  revision: AudioFileRevision | null,
): string {
  const sourceKey = track.soundcloud
    ? `soundcloud:${track.soundcloud.id}`
    : `${track.source || "local"}:${track.id}`;
  return [
    sourceKey,
    Math.round((track.duration || 0) * 1_000),
    track.fileName,
    track.sampleRate || 0,
    track.bitRate || 0,
    revision ? Math.trunc(revision.size) : "remote",
    revision ? Math.trunc(revision.mtimeMs) : "remote",
  ].join("|");
}

async function resolveTrackCacheKey(track: LibraryTrack): Promise<string | null> {
  if (track.source === "soundcloud" || track.soundcloud) {
    return buildTrackNormalizationCacheKey(track, null);
  }

  try {
    const revision = await window.playhead.getAudioFileRevision(track.path);
    return buildTrackNormalizationCacheKey(track, revision);
  } catch (error) {
    console.warn("Could not read audio file revision", { path: track.path, error });
    return null;
  }
}

function saveNormalizationCacheEntry(cacheKey: string, loudnessDb: number, gain: number): void {
  const cache = getNormalizationCache();
  cache[cacheKey] = { gain, loudnessDb, analyzedAt: Date.now() };

  const entries = Object.entries(cache);
  if (entries.length > normalizationCacheLimit) {
    entries
      .sort(([, a], [, b]) => b.analyzedAt - a.analyzedAt)
      .slice(normalizationCacheLimit)
      .forEach(([key]) => delete cache[key]);
  }

  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(normalizationCacheStorageKey, JSON.stringify(cache));
  } catch {
    // Cache persistence is optional. Normalization still works for this session.
  }
}

async function decodeTrackForNormalization(track: LibraryTrack): Promise<AudioBuffer | null> {
  if (track.source === "soundcloud" || track.soundcloud) {
    const soundcloud = track.soundcloud;
    if (!soundcloud || !track.duration || track.duration > 480) return null;

    const bytes = await window.playhead.getSoundCloudAnalysisAudioData(
      soundcloud.id,
      track.duration,
      soundcloud.transcodings,
      soundcloud.trackAuthorization,
    );
    return bytes ? decodeAudioBytes(bytes) : null;
  }

  return decodeAudioTrack(track, window.playhead.readAudioFile);
}

function enqueueAnalysis<T>(task: () => Promise<T>): Promise<T> {
  const result = analysisQueue.then(task, task);
  analysisQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function getCachedGain(cached: CachedNormalization | undefined, maxGainDb?: number): number | null {
  if (!cached) return null;
  if (maxGainDb !== undefined && Number.isFinite(cached.loudnessDb)) {
    return getLoudnessNormalizationGain(cached.loudnessDb, undefined, maxGainDb);
  }
  return Number.isFinite(cached.gain) ? cached.gain : null;
}

export async function getCachedTrackNormalizationGain(
  track: LibraryTrack,
  maxGainDb?: number,
): Promise<number | null> {
  const cacheKey = await resolveTrackCacheKey(track);
  if (!cacheKey) return null;
  return getCachedGain(getNormalizationCache()[cacheKey], maxGainDb);
}

export async function analyzeTrackNormalizationGain(
  track: LibraryTrack,
  signal?: AbortSignal,
  maxGainDb?: number,
): Promise<number> {
  const cacheKey = await resolveTrackCacheKey(track);
  if (signal?.aborted) return 1;
  if (cacheKey) {
    const cachedGain = getCachedGain(getNormalizationCache()[cacheKey], maxGainDb);
    if (cachedGain !== null) return cachedGain;
  }

  return enqueueAnalysis(async () => {
    if (signal?.aborted) return 1;
    if (cacheKey) {
      const cachedGain = getCachedGain(getNormalizationCache()[cacheKey], maxGainDb);
      if (cachedGain !== null) return cachedGain;
    }

    try {
      const buffer = await decodeTrackForNormalization(track);
      if (!buffer || signal?.aborted) return 1;

      const loudnessDb = await analyzeLoudnessOffThread(buffer, signal);
      if (loudnessDb === null || signal?.aborted) return 1;

      const gain = getLoudnessNormalizationGain(loudnessDb);
      if (cacheKey) saveNormalizationCacheEntry(cacheKey, loudnessDb, gain);
      return maxGainDb === undefined
        ? gain
        : getLoudnessNormalizationGain(loudnessDb, undefined, maxGainDb);
    } catch (error) {
      if (!isAbortError(error)) {
        console.warn("Failed to analyze track loudness", { path: track.path, error });
      }
      return 1;
    }
  });
}
