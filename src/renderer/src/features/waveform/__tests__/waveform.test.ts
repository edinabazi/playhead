import { describe, expect, it } from "vitest";
import { buildPeaks, getWaveformProgress } from "../waveform";

function createBuffer(samples: number[], sampleRate = 1): AudioBuffer {
  return {
    numberOfChannels: 1,
    length: samples.length,
    duration: samples.length / sampleRate,
    sampleRate,
    getChannelData: () => Float32Array.from(samples),
  } as unknown as AudioBuffer;
}

describe("buildPeaks", () => {
  it("builds normalized min/max peaks", () => {
    const peaks = buildPeaks(createBuffer([-0.5, 0.25, -1, 0.75]), 2);
    expect(peaks).toEqual([
      { min: -0.5, max: 0.25 },
      { min: -1, max: 0.75 },
    ]);
  });

  it("keeps silent peaks at zero", () => {
    expect(buildPeaks(createBuffer([0, 0, 0]), 2)).toEqual([
      { min: 0, max: 0 },
      { min: 0, max: 0 },
    ]);
  });

  it("includes the full buffer when samples do not divide evenly", () => {
    expect(buildPeaks(createBuffer([0, 0, 0, 0, 1]), 2)).toEqual([
      { min: 0, max: 0 },
      { min: 0, max: 1 },
    ]);
  });

  it("limits peaks to the requested timeline duration", () => {
    expect(buildPeaks(createBuffer([1, 0, 0, 0, 0, -1], 1), 2, 3)).toEqual([
      { min: 0, max: 1 },
      { min: 0, max: 0 },
    ]);
  });
});

describe("getWaveformProgress", () => {
  it("maps progress to the playable media duration", () => {
    expect(getWaveformProgress(50, 100)).toBe(0.5);
  });

  it("clamps invalid and out-of-range progress", () => {
    expect(getWaveformProgress(25, 0)).toBe(0);
    expect(getWaveformProgress(-10, 100)).toBe(0);
    expect(getWaveformProgress(125, 100)).toBe(1);
  });
});
