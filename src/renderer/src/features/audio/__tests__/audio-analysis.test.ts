import { describe, expect, it } from "vitest";
import {
  buildWaveformCachePeaks,
  estimateIntegratedLoudnessDb,
  getLoudnessNormalizationGain,
  getWaveformAnalysisPeakCount,
  shouldAnalyzeTrackBpm,
} from "../audio-analysis";
import type { LibraryTrack } from "../../../../../shared/library";

function createTrack(overrides: Partial<LibraryTrack> = {}): LibraryTrack {
  return {
    id: "track-1",
    path: "/music/a.mp3",
    fileName: "a.mp3",
    title: "A",
    artist: "Artist",
    duration: 1,
    folderId: "folder-1",
    ...overrides,
  };
}

function createBuffer(samples: number[], sampleRate = 1): AudioBuffer {
  return {
    numberOfChannels: 1,
    length: samples.length,
    duration: samples.length / sampleRate,
    sampleRate,
    getChannelData: () => Float32Array.from(samples),
  } as unknown as AudioBuffer;
}

function createSineBuffer({
  frequency,
  sampleRate,
  duration,
  amplitude = 1,
}: {
  frequency: number;
  sampleRate: number;
  duration: number;
  amplitude?: number;
}): AudioBuffer {
  const samples = Array.from(
    { length: sampleRate * duration },
    (_, index) => amplitude * Math.sin((2 * Math.PI * frequency * index) / sampleRate),
  );
  return createBuffer(samples, sampleRate);
}

describe("shouldAnalyzeTrackBpm", () => {
  it("includes tracks without bpm", () => {
    expect(shouldAnalyzeTrackBpm(createTrack())).toBe(true);
  });

  it("skips metadata and legacy bpm", () => {
    expect(shouldAnalyzeTrackBpm(createTrack({ bpm: 128, bpmSource: "metadata" }))).toBe(false);
    expect(shouldAnalyzeTrackBpm(createTrack({ bpm: 128 }))).toBe(false);
  });

  it("allows analyzed bpm to be revalidated from cache", () => {
    expect(shouldAnalyzeTrackBpm(createTrack({ bpm: 128, bpmSource: "analysis" }))).toBe(true);
  });
});

describe("volume normalization", () => {
  it.each([16_000, 48_000])("matches the BS.1770 reference level at %i Hz", (sampleRate) => {
    const loudnessDb = estimateIntegratedLoudnessDb(
      createSineBuffer({ frequency: 997, sampleRate, duration: 1 }),
    );
    expect(loudnessDb).toBeCloseTo(-3.01, 1);
  });

  it("attenuates toward -18 dB without boosting quiet tracks", () => {
    expect(getLoudnessNormalizationGain(-20)).toBe(1);
    expect(getLoudnessNormalizationGain(-8)).toBeCloseTo(10 ** (-10 / 20), 5);
    expect(getLoudnessNormalizationGain(-40)).toBe(1);
    expect(getLoudnessNormalizationGain(4)).toBeCloseTo(10 ** (-12 / 20), 5);
  });

  it("lifts quiet tracks up to the boosted limit when allowed", () => {
    expect(getLoudnessNormalizationGain(-21, undefined, 6)).toBeCloseTo(10 ** (3 / 20), 5);
    expect(getLoudnessNormalizationGain(-40, undefined, 6)).toBeCloseTo(10 ** (6 / 20), 5);
    expect(getLoudnessNormalizationGain(-8, undefined, 6)).toBeCloseTo(10 ** (-10 / 20), 5);
  });

  it("ignores silence", () => {
    expect(estimateIntegratedLoudnessDb(createBuffer([0, 0, 0], 3))).toBeNull();
  });
});

describe("buildWaveformCachePeaks", () => {
  it("produces one channel of normalized signed peaks", () => {
    const peaks = buildWaveformCachePeaks(createBuffer([-0.5, 0.25, -1, 0.75]), 2);
    expect(peaks).toHaveLength(1);
    expect(peaks[0]).toHaveLength(40);
    expect(Math.max(...peaks[0].map((peak) => Math.abs(peak)))).toBe(1);
  });

  it("keeps silent peaks at zero", () => {
    const peaks = buildWaveformCachePeaks(createBuffer([0, 0, 0]), 2);
    expect(peaks[0]).toHaveLength(40);
    expect(peaks[0].every((peak) => peak === 0)).toBe(true);
  });

  it("caps long peak counts", () => {
    expect(getWaveformAnalysisPeakCount(10_000)).toBe(24_000);
  });
});
