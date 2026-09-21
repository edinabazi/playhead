import { describe, expect, it } from "vitest";
import {
  createMeterChannelState,
  getHoldSegmentIndex,
  getLitSegmentCount,
  isMeterChannelAtRest,
  meterFloorDb,
  normalizeLevelMeterSettings,
  stepMeterChannel,
  toDb,
  type MeterChannelState,
} from "../meter-model";

function run(state: MeterChannelState, peak: number | null, seconds: number, startAt = 0) {
  let next = state;
  const dt = 1 / 60;
  for (let time = startAt; time < startAt + seconds; time += dt) {
    next = stepMeterChannel(next, peak, time, dt);
  }
  return next;
}

const dbToLinear = (db: number) => 10 ** (db / 20);

describe("level meter model", () => {
  it("converts linear peaks to dB with a floor", () => {
    expect(toDb(1)).toBe(0);
    expect(toDb(dbToLinear(-12))).toBeCloseTo(-12, 5);
    expect(toDb(0)).toBe(meterFloorDb);
  });

  it("jumps to peaks, holds the peak, then releases", () => {
    const loud = run(createMeterChannelState(), dbToLinear(-6), 0.5);
    expect(loud.levelDb).toBeCloseTo(-6, 5);
    expect(loud.holdDb).toBeCloseTo(-6, 5);

    const afterHalfSecond = run(loud, null, 0.5, 0.5);
    expect(afterHalfSecond.levelDb).toBeCloseTo(-19, 0);
    expect(afterHalfSecond.holdDb).toBeCloseTo(-6, 5);

    const afterHold = run(afterHalfSecond, null, 1.5, 1);
    expect(afterHold.holdDb).toBeLessThan(-6);
  });

  it("comes to rest after playback stops", () => {
    const playing = run(createMeterChannelState(), 0.8, 1);
    expect(isMeterChannelAtRest(playing)).toBe(false);
    expect(isMeterChannelAtRest(run(playing, null, 6, 1))).toBe(true);
  });

  it("maps levels to lit segments and the peak hold segment", () => {
    expect(getLitSegmentCount(-40, 48)).toBe(0);
    expect(getLitSegmentCount(-20, 48)).toBe(24);
    expect(getLitSegmentCount(-11, 48)).toBe(35);
    expect(getLitSegmentCount(3, 48)).toBe(48);

    expect(getHoldSegmentIndex(-39.5, 48)).toBeNull();
    expect(getHoldSegmentIndex(-20, 48)).toBe(23);
    expect(getHoldSegmentIndex(0, 48)).toBe(47);
    expect(getHoldSegmentIndex(6, 48)).toBe(47);
  });

  it("repairs stored meter settings", () => {
    expect(normalizeLevelMeterSettings(undefined)).toEqual({ open: false });
    expect(normalizeLevelMeterSettings({ open: true, unknown: 1 } as never)).toEqual({
      open: true,
    });
  });
});
