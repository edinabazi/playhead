import { describe, expect, it, vi } from "vitest";
import { PlaybackClock } from "../playback-clock";

describe("PlaybackClock", () => {
  it("notifies subscribers when the displayed second changes", () => {
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
  it("retains precise frame times without notifying within a second", () => {
    const clock = new PlaybackClock();
    const listener = vi.fn();
    clock.subscribe(listener);

    for (let frame = 1; frame < 120; frame += 1) clock.setTime(frame / 120);
    expect(listener).not.toHaveBeenCalled();
    expect(clock.getTime()).toBe(119 / 120);
    clock.setTime(1);
    expect(listener).toHaveBeenCalledTimes(1);
    clock.setTime(1.75);
    expect(clock.getTime()).toBe(1.75);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("notifies immediately for forward seeks, backward seeks, and track resets", () => {
    const clock = new PlaybackClock();
    const displayedSeconds: number[] = [];
    clock.subscribe(() => displayedSeconds.push(clock.getWholeSeconds()));
    clock.setTime(59.99);
    clock.setTime(60);
    clock.setTime(125.4);
    clock.setTime(12.8);
    clock.setTime(12.1);
    expect(clock.getTime()).toBe(12.1);
    clock.setTime(0);
    clock.setTime(0.2);
    clock.setTime(Number.NaN);
    expect(clock.getTime()).toBe(0);
    expect(displayedSeconds).toEqual([59, 60, 125, 12, 0]);
  });
});
