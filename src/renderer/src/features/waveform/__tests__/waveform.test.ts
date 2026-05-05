import { describe, expect, it } from "vitest";
import { buildPeaks } from "../waveform";

function createBuffer(samples: number[]): AudioBuffer {
  return {
    numberOfChannels: 1,
    length: samples.length,
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
});
