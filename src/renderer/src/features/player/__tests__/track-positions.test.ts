import { describe, expect, it } from "vitest";
import { resumePosition, withTrackPosition } from "../track-positions";

describe("track positions", () => {
  it("stores positions and drops ones near the start or end", () => {
    expect(withTrackPosition({}, "a", 42, 200)).toEqual({ a: 42 });
    expect(withTrackPosition({ a: 42 }, "a", 1, 200)).toEqual({});
    expect(withTrackPosition({ a: 42 }, "a", 199, 200)).toEqual({});
    expect(withTrackPosition({ b: 10 }, "a", 50)).toEqual({ a: 50, b: 10 });
  });

  it("resumes only from meaningful positions", () => {
    expect(resumePosition(undefined, 200)).toBe(0);
    expect(resumePosition(2, 200)).toBe(0);
    expect(resumePosition(80, 200)).toBe(80);
    expect(resumePosition(198, 200)).toBe(0);
    expect(resumePosition(80)).toBe(80);
  });
});
