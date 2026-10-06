import { describe, expect, it } from "vitest";
import { normalizeLoop } from "../LoopRegion";

describe("normalizeLoop", () => {
  it("orders the ends and clamps them to the track", () => {
    expect(normalizeLoop(30, 10, 100)).toEqual({ start: 10, end: 30 });
    expect(normalizeLoop(-5, 120, 100)).toEqual({ start: 0, end: 100 });
  });

  it("ignores loops that are too short to be intentional", () => {
    expect(normalizeLoop(10, 10.1, 100)).toBeNull();
  });
});
