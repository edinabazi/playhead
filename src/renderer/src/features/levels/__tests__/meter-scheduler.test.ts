import { describe, expect, it, vi } from "vitest";
import { scheduleMeterFrames } from "../meter-scheduler";

// Drive the real scheduler using display refresh boundaries and independent timer deadlines.
function simulate(refresh: number, interval: number) {
  let now = 0;
  let nextId = 1;
  const timers = new Map<number, { at: number; callback: () => void }>();
  const frames = new Map<number, (time: number) => void>();
  const draws: number[] = [];
  const stop = scheduleMeterFrames(
    (time) => {
      draws.push(time);
      return true;
    },
    interval,
    {
      requestFrame: (callback) => {
        const id = nextId++;
        frames.set(id, callback);
        return id;
      },
      cancelFrame: (id) => {
        frames.delete(id);
      },
      setTimer: (callback, delay) => {
        const id = nextId++;
        timers.set(id, { at: now + delay, callback });
        return id;
      },
      clearTimer: (id) => {
        timers.delete(id);
      },
    },
  );
  for (let frame = 0; frame <= refresh; frame++) {
    now = (frame * 1000) / refresh;
    for (const [id, timer] of [...timers])
      if (timer.at <= now) {
        timers.delete(id);
        timer.callback();
      }
    const pending = [...frames];
    frames.clear();
    for (const [, callback] of pending) callback(now);
  }
  stop();
  return { draws, timers, frames };
}

describe("meter frame deadlines", () => {
  it.each([60, 120, 144, 240])(
    "never exceeds 20 fps on a %i Hz display and cancels work",
    (refresh) => {
      const { draws, timers, frames } = simulate(refresh, 50);
      expect(draws.length).toBeLessThanOrEqual(21); // includes t=0
      for (let i = 1; i < draws.length; i++)
        expect(draws[i] - draws[i - 1]).toBeGreaterThanOrEqual(50);
      expect(timers.size).toBe(0);
      expect(frames.size).toBe(0);
      expect(simulate(refresh, 100).draws.length).toBeLessThanOrEqual(11);
    },
  );
  it("does not reschedule once the paused meter has settled", () => {
    const setTimer = vi.fn();
    let callback: (time: number) => void = () => {};
    scheduleMeterFrames(() => false, 50, {
      requestFrame: (next) => {
        callback = next;
        return 1;
      },
      cancelFrame: vi.fn(),
      setTimer,
      clearTimer: vi.fn(),
    });
    callback(0);
    expect(setTimer).not.toHaveBeenCalled();
  });
});
