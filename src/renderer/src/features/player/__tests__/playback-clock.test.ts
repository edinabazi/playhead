import { describe, expect, it, vi } from "vitest";
import { PlaybackClock } from "../playback-clock";

describe("PlaybackClock", () => {
  it("notifies subscribers only when the time changes", () => {
    const clock = new PlaybackClock();
    const listener = vi.fn();
    const unsubscribe = clock.subscribe(listener);

    clock.setTime(1.25);
    clock.setTime(1.25);
    clock.setTime(Number.NaN);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(clock.getTime()).toBe(0);

    unsubscribe();
    clock.setTime(3);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("exposes whole seconds for the elapsed time label", () => {
    const clock = new PlaybackClock();
    clock.setTime(59.99);
    expect(clock.getWholeSeconds()).toBe(59);
    clock.setTime(-4);
    expect(clock.getWholeSeconds()).toBe(0);
  });
});
