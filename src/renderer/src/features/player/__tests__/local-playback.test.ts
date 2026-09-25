import { afterEach, expect, it, vi } from "vitest";
import { loadLocalPlayback, PlaybackLoadError } from "../local-playback";
import { playbackFailure } from "../../../../../shared/playback";

function fixture() {
  const media = document.createElement("audio");
  Object.defineProperty(media, "readyState", { configurable: true, value: 2 });
  const player = {
    load: vi.fn().mockResolvedValue(undefined),
    setOptions: vi.fn(),
    getMediaElement: () => media,
    getDuration: () => 120,
    setTime: vi.fn(),
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
  };
  const api = {
    preparePlaybackCopy: vi.fn().mockResolvedValue({ url: "playhead-media://local" }),
    cancelPlaybackCopy: vi.fn().mockResolvedValue(undefined),
  };
  const controller = new AbortController();
  const options = {
    player,
    api,
    controller,
    url: "playhead-media://network",
    path: "/NAS/song.flac",
    requestId: 1,
    duration: 120,
    cached: { peaks: [[0.1]], duration: 120 },
    startTime: 40,
    autoplay: true,
    signal: controller.signal,
    onPreparing: vi.fn(),
  };
  return options;
}
afterEach(() => vi.useRealTimers());
it("keeps successful playback direct, seeking before play", async () => {
  const options = fixture();
  expect(await loadLocalPlayback(options)).toEqual({ copied: false });
  expect(options.api.preparePlaybackCopy).not.toHaveBeenCalled();
  expect(options.player.setTime).toHaveBeenCalledExactlyOnceWith(40);
  expect(options.player.play).toHaveBeenCalledOnce();
});
it.each(["load", "play"] as const)(
  "recovers a %s failure with one local copy and preserves the position",
  async (method) => {
    const options = fixture();
    options.player[method].mockRejectedValueOnce(new Error("network source failed"));
    expect(await loadLocalPlayback(options)).toEqual({ copied: true });
    expect(options.api.preparePlaybackCopy).toHaveBeenCalledExactlyOnceWith("/NAS/song.flac", 1);
    expect(options.player.load).toHaveBeenLastCalledWith("playhead-media://local", [[0.1]], 120);
    expect(options.player.setTime).toHaveBeenLastCalledWith(40);
    expect(options.onPreparing).toHaveBeenCalledOnce();
  },
);
it("recovers asynchronous media errors while waiting for cached audio readiness", async () => {
  const options = fixture();
  const media = options.player.getMediaElement();
  Object.defineProperty(media, "readyState", { configurable: true, value: 0 });
  options.player.load.mockImplementationOnce(async () => {
    queueMicrotask(() => {
      Object.defineProperty(media, "error", {
        configurable: true,
        value: { code: 2, message: "Network failed" },
      });
      media.dispatchEvent(new Event("error"));
    });
  });
  options.player.load.mockImplementationOnce(async () => {
    Object.defineProperty(media, "readyState", { value: 2 });
    Object.defineProperty(media, "error", { configurable: true, value: null });
  });
  expect(await loadLocalPlayback(options)).toEqual({ copied: true });
});
it("shows a filesystem-specific failure if recovery cannot read the source", async () => {
  const options = fixture();
  options.player.load.mockRejectedValue(new Error("unavailable"));
  const failure = playbackFailure({ code: "EACCES" });
  options.api.preparePlaybackCopy.mockResolvedValue({ failure });
  await expect(loadLocalPlayback(options)).rejects.toMatchObject({ failure });
  expect(options.player.play).not.toHaveBeenCalled();
});
it("cancels an obsolete copy without allowing its eventual result to play", async () => {
  const options = fixture();
  options.player.load.mockRejectedValueOnce(new Error("unavailable"));
  let finish!: (value: { url: string }) => void;
  options.api.preparePlaybackCopy.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const pending = loadLocalPlayback(options);
  const rejected = expect(pending).rejects.toMatchObject({ name: "AbortError" });
  await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
  options.controller.abort();
  await rejected;
  finish({ url: "playhead-media://stale" });
  await Promise.resolve();
  expect(options.player.play).not.toHaveBeenCalled();
  expect(options.api.cancelPlaybackCopy).toHaveBeenCalledWith(1);
});
it("bounds a hung direct load and attempts recovery only once", async () => {
  vi.useFakeTimers();
  const options = fixture();
  options.player.load.mockImplementationOnce(() => new Promise(() => {}));
  options.player.load.mockRejectedValueOnce(
    Object.assign(new Error("decode failure"), { code: 3 }),
  );
  const pending = loadLocalPlayback(options);
  const rejected = expect(pending).rejects.toBeInstanceOf(PlaybackLoadError);
  await vi.advanceTimersByTimeAsync(20_001);
  await rejected;
  expect(options.api.preparePlaybackCopy).toHaveBeenCalledOnce();
});
it("restores paused playback without automatically playing", async () => {
  const options = fixture();
  expect(await loadLocalPlayback({ ...options, forceCopy: true, autoplay: false })).toEqual({
    copied: true,
  });
  expect(options.player.load).toHaveBeenCalledOnce();
  expect(options.player.play).not.toHaveBeenCalled();
});
