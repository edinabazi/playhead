import { describe, expect, it } from "vitest";
import { PlaybackVolumeController, type VolumeAnimationScheduler } from "../playback-volume";

function createScheduler(): VolumeAnimationScheduler & { advanceTo: (time: number) => void } {
  let now = 0;
  let nextId = 0;
  const frames = new Map<number, () => void>();

  return {
    now: () => now,
    requestFrame: (callback) => {
      nextId += 1;
      frames.set(nextId, callback);
      return nextId;
    },
    cancelFrame: (id) => {
      frames.delete(id);
    },
    advanceTo: (time) => {
      now = time;
      const callbacks = [...frames.values()];
      frames.clear();
      callbacks.forEach((callback) => callback());
    },
  };
}

describe("PlaybackVolumeController", () => {
  it("adjusts the user's base volume without compounding normalization gain", () => {
    const outputs: number[] = [];
    const controller = new PlaybackVolumeController((volume) => outputs.push(volume));

    controller.setBaseVolume(0.8);
    controller.setNormalizationGain(0.5);
    controller.adjustBaseVolume(0.05);

    expect(controller.getBaseVolume()).toBeCloseTo(0.85);
    expect(outputs.at(-1)).toBeCloseTo(0.425);
  });

  it("ramps an uncached gain change instead of applying an abrupt drop", () => {
    const outputs: number[] = [];
    const scheduler = createScheduler();
    const controller = new PlaybackVolumeController((volume) => outputs.push(volume), scheduler);

    controller.setBaseVolume(1);
    controller.setNormalizationGain(0.5, 200);
    expect(outputs.at(-1)).toBe(1);

    scheduler.advanceTo(100);
    expect(outputs.at(-1)).toBeCloseTo(0.75);

    scheduler.advanceTo(200);
    expect(outputs.at(-1)).toBeCloseTo(0.5);
  });

  it("restores the user's base volume when normalization is disabled", () => {
    const outputs: number[] = [];
    const controller = new PlaybackVolumeController((volume) => outputs.push(volume));

    controller.setBaseVolume(0.8);
    controller.setNormalizationGain(0.5);
    controller.setNormalizationGain(1);

    expect(outputs.at(-1)).toBeCloseTo(0.8);
  });

  it("keeps volume at 100% unless boost raises the maximum", () => {
    const outputs: number[] = [];
    const gains: number[] = [];
    const controller = new PlaybackVolumeController(
      (volume) => outputs.push(volume),
      undefined,
      (gain) => gains.push(gain),
    );

    expect(controller.setBaseVolume(1.5)).toBe(1);
    expect(gains.at(-1)).toBe(1);

    controller.setMaxVolume(2);
    expect(controller.setBaseVolume(1.5)).toBe(1.5);
    expect(outputs.at(-1)).toBe(1);
    expect(gains.at(-1)).toBe(1.5);
  });

  it("applies normalization to the element volume and boost as gain", () => {
    const outputs: number[] = [];
    const gains: number[] = [];
    const controller = new PlaybackVolumeController(
      (volume) => outputs.push(volume),
      undefined,
      (gain) => gains.push(gain),
    );

    controller.setMaxVolume(2);
    controller.setBaseVolume(1.6);
    controller.setNormalizationGain(0.5);

    expect(outputs.at(-1)).toBeCloseTo(0.5);
    expect(gains.at(-1)).toBeCloseTo(1.6);
  });

  it("clamps a boosted volume back to 100% when boost is turned off", () => {
    const outputs: number[] = [];
    const gains: number[] = [];
    const controller = new PlaybackVolumeController(
      (volume) => outputs.push(volume),
      undefined,
      (gain) => gains.push(gain),
    );

    controller.setMaxVolume(2);
    controller.setBaseVolume(1.8);

    expect(controller.setMaxVolume(1)).toBe(1);
    expect(outputs.at(-1)).toBe(1);
    expect(gains.at(-1)).toBe(1);
  });
});
