import type WaveSurfer from "wavesurfer.js";
import { playbackFailure, type PlaybackFailure } from "../../../../shared/playback";
import type { PlayheadApi, WaveformCacheEntry } from "../../../../shared/library";

export class PlaybackLoadError extends Error {
  constructor(readonly failure: PlaybackFailure) {
    super(failure.message);
  }
}
export function waitForPlayback<T>(
  operation: Promise<T>,
  signal: AbortSignal,
  milliseconds = 20_000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const aborted = () => {
      cleanup();
      reject(new DOMException("Cancelled", "AbortError"));
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(Object.assign(new Error("Playback timed out"), { code: "ETIMEDOUT" }));
    }, milliseconds);
    const cleanup = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", aborted);
    };
    signal.addEventListener("abort", aborted, { once: true });
    operation.then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (error) => {
        cleanup();
        reject(error);
      },
    );
    if (signal.aborted) aborted();
  });
}
function playable(media: HTMLMediaElement, signal: AbortSignal): Promise<void> {
  if (media.error) return Promise.reject(media.error);
  if (media.readyState >= 2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      media.removeEventListener("loadeddata", ready);
      media.removeEventListener("canplay", ready);
      media.removeEventListener("error", failed);
      signal.removeEventListener("abort", aborted);
    };
    const ready = () => {
      cleanup();
      resolve();
    };
    const failed = () => {
      cleanup();
      reject(media.error ?? new Error("Media unavailable"));
    };
    const aborted = () => {
      cleanup();
      reject(new DOMException("Cancelled", "AbortError"));
    };
    media.addEventListener("loadeddata", ready, { once: true });
    media.addEventListener("canplay", ready, { once: true });
    media.addEventListener("error", failed, { once: true });
    signal.addEventListener("abort", aborted, { once: true });
    if (signal.aborted) aborted();
  });
}

type LocalPlayer = Pick<
  WaveSurfer,
  "load" | "setOptions" | "getMediaElement" | "getDuration" | "setTime" | "play" | "pause"
>;
export async function loadLocalPlayback({
  player,
  url,
  path,
  requestId,
  duration,
  cached,
  startTime,
  autoplay,
  signal,
  forceCopy,
  api,
  onPreparing,
}: {
  player: LocalPlayer;
  url: string;
  path: string;
  requestId: number;
  duration: number;
  cached: WaveformCacheEntry | null;
  startTime: number;
  autoplay: boolean;
  signal: AbortSignal;
  forceCopy?: boolean;
  api: Pick<PlayheadApi, "preparePlaybackCopy" | "cancelPlaybackCopy">;
  onPreparing: () => void;
}): Promise<{ copied: boolean }> {
  const attempt = async (source: string) => {
    signal.throwIfAborted();
    const fetch = new AbortController();
    const abort = () => fetch.abort();
    signal.addEventListener("abort", abort, { once: true });
    const media = player.getMediaElement();
    let rejectMedia!: (error: unknown) => void;
    const mediaError = new Promise<never>((_resolve, reject) => {
      rejectMedia = reject;
    });
    const onError = () => rejectMedia(media.error ?? new Error("Media unavailable"));
    try {
      player.setOptions({ fetchParams: { signal: fetch.signal } });
      media.addEventListener("error", onError);
      await waitForPlayback(
        Promise.race([
          player.load(source, cached?.peaks, cached?.duration || duration || 0.001),
          mediaError,
        ]),
        signal,
      );
      await waitForPlayback(playable(media, fetch.signal), signal);
      signal.throwIfAborted();
      if (startTime > 0) player.setTime(Math.min(startTime, player.getDuration()));
      if (autoplay) await waitForPlayback(player.play(), signal);
    } finally {
      media.removeEventListener("error", onError);
      signal.removeEventListener("abort", abort);
      fetch.abort();
    }
  };
  if (!forceCopy) {
    try {
      await attempt(url);
      return { copied: false };
    } catch (error) {
      if (signal.aborted) throw error;
    }
  }
  signal.throwIfAborted();
  player.pause();
  onPreparing();
  const cancelCopy = () => {
    void api.cancelPlaybackCopy(requestId).catch(() => {});
  };
  signal.addEventListener("abort", cancelCopy, { once: true });
  try {
    const prepared = await waitForPlayback(
      api.preparePlaybackCopy(path, requestId),
      signal,
      46_000,
    );
    signal.throwIfAborted();
    if (prepared.failure) throw new PlaybackLoadError(prepared.failure);
    try {
      await attempt(prepared.url);
    } catch (error) {
      throw new PlaybackLoadError(playbackFailure(error));
    }
    return { copied: true };
  } finally {
    signal.removeEventListener("abort", cancelCopy);
    cancelCopy();
  }
}
