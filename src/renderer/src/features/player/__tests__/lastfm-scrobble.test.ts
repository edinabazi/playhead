import { describe, expect, it } from "vitest";
import {
  createLastfmPlaybackSession,
  shouldScrobbleLastfmTrack,
  updateLastfmPlaybackProgress,
} from "../lastfm-scrobble";

describe("Last.fm scrobble playback tracking", () => {
  it("skips tracks shorter than 30 seconds", () => {
    const session = updateLastfmPlaybackProgress(createLastfmPlaybackSession("track-1"), 20);

    expect(shouldScrobbleLastfmTrack(session, 29)).toBe(false);
  });

  it("scrobbles after half of a normal-length track has been played", () => {
    const session = updateLastfmPlaybackProgress(createLastfmPlaybackSession("track-1"), 90);

    expect(shouldScrobbleLastfmTrack(session, 180)).toBe(true);
  });

  it("scrobbles long tracks after four minutes of playback", () => {
    const session = updateLastfmPlaybackProgress(createLastfmPlaybackSession("track-1"), 240);

    expect(shouldScrobbleLastfmTrack(session, 900)).toBe(true);
  });

  it("does not scrobble the same playback twice", () => {
    const session = {
      ...updateLastfmPlaybackProgress(createLastfmPlaybackSession("track-1"), 120),
      scrobbled: true,
    };

    expect(shouldScrobbleLastfmTrack(session, 180)).toBe(false);
  });

  it("does not count backwards movement as playback", () => {
    const started = createLastfmPlaybackSession("track-1");
    const afterForward = updateLastfmPlaybackProgress(started, 20);
    const afterBackward = updateLastfmPlaybackProgress(afterForward, 10);

    expect(afterBackward.maxPlayedSeconds).toBe(20);
    expect(shouldScrobbleLastfmTrack(afterBackward, 60)).toBe(false);
  });
});
