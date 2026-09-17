import { describe, expect, it } from "vitest";
import { getRestingBarPose, sampleNowPlayingBar } from "../now-playing-bars";

describe("now playing bars", () => {
  it("follows the indicator keyframes over its cycle", () => {
    expect(sampleNowPlayingBar(0, 0)).toEqual({ scale: 0.5, opacity: 0.55 });
    const peak = sampleNowPlayingBar(0.48 * 2.18, 0);
    expect(peak.scale).toBeCloseTo(1, 5);
    expect(peak.opacity).toBeCloseTo(1, 5);
    expect(sampleNowPlayingBar(2.18, 0).scale).toBeCloseTo(0.5, 5);
  });

  it("offsets each bar by its delay and keeps poses in range", () => {
    expect(sampleNowPlayingBar(0.22, 0.22)).toEqual(sampleNowPlayingBar(0, 0));
    for (let time = 0; time < 5; time += 0.07) {
      const pose = sampleNowPlayingBar(time, 0.33);
      expect(pose.scale).toBeGreaterThanOrEqual(0.43);
      expect(pose.scale).toBeLessThanOrEqual(1);
    }
    expect(getRestingBarPose(0.11)).toEqual(sampleNowPlayingBar(0.71, 0.11));
  });
});
