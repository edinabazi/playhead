import { describe, expect, it } from "vitest";
import type { LibraryTrack } from "../../../../../shared/library";
import {
  buildTrackNormalizationCacheKey,
  getReplayGainNormalizationGain,
} from "../volume-normalization";

const track: LibraryTrack = {
  id: "track-1",
  path: "/music/track.mp3",
  fileName: "track.mp3",
  title: "Track",
  artist: "Artist",
  duration: 180,
  folderId: "folder-1",
};

describe("volume normalization cache", () => {
  it("invalidates a local result when the source file changes", () => {
    const original = buildTrackNormalizationCacheKey(track, { size: 1_000, mtimeMs: 100 });
    const replaced = buildTrackNormalizationCacheKey(track, { size: 1_200, mtimeMs: 200 });

    expect(replaced).not.toBe(original);
  });
});

describe("ReplayGain", () => {
  it("uses the tagged track gain, clamped like measured loudness", () => {
    expect(getReplayGainNormalizationGain(track)).toBeNull();
    // Turning a loud track down by 6 dB.
    expect(getReplayGainNormalizationGain({ ...track, replayGainDb: -6 })).toBeCloseTo(
      10 ** (-6 / 20),
    );
    // Boosts are capped at 0 dB unless a higher ceiling is allowed.
    expect(getReplayGainNormalizationGain({ ...track, replayGainDb: 4 })).toBe(1);
    expect(getReplayGainNormalizationGain({ ...track, replayGainDb: 4 }, 6)).toBeCloseTo(
      10 ** (4 / 20),
    );
  });
});
