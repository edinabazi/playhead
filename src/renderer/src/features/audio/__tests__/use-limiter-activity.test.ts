import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useLimiterActivity } from "../use-limiter-activity";

beforeEach(() => vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "performance"] }));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it("only lights after actual reduction, holds briefly, and stops polling when paused", () => {
  let reduction = 0;
  const read = vi.fn(() => reduction);
  const { result, rerender } = renderHook(({ enabled }) => useLimiterActivity(read, enabled), {
    initialProps: { enabled: true },
  });
  act(() => vi.advanceTimersByTime(100));
  expect(result.current).toBe(false);
  reduction = -2;
  act(() => vi.advanceTimersByTime(100));
  expect(result.current).toBe(true);
  reduction = 0;
  act(() => vi.advanceTimersByTime(200));
  expect(result.current).toBe(true);
  act(() => vi.advanceTimersByTime(100));
  expect(result.current).toBe(false);
  rerender({ enabled: false });
  expect(vi.getTimerCount()).toBe(0);
});
