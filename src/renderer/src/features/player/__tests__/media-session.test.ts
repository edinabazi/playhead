import { afterEach, describe, expect, it, vi } from "vitest";
import { setMediaActionHandler, updateMediaPosition } from "../media-session";

afterEach(() => vi.unstubAllGlobals());
describe("media session position updates", () => {
  it("reports fresh positions on seek and track changes and clamps track boundaries", () => {
    const setPositionState = vi.fn();
    vi.stubGlobal("navigator", { mediaSession: { setPositionState } });
    updateMediaPosition(180, 20);
    updateMediaPosition(180, 65);
    updateMediaPosition(4, 0);
    updateMediaPosition(4, 5);
    expect(setPositionState.mock.calls.map(([state]) => state)).toEqual([
      { duration: 180, position: 20, playbackRate: 1 },
      { duration: 180, position: 65, playbackRate: 1 },
      { duration: 4, position: 0, playbackRate: 1 },
      { duration: 4, position: 4, playbackRate: 1 },
    ]);
  });
  it("tolerates unsupported OS media actions and unknown stream durations", () => {
    const setPositionState = vi.fn();
    vi.stubGlobal("navigator", {
      mediaSession: {
        setPositionState,
        setActionHandler: () => {
          throw new Error("Unsupported action");
        },
      },
    });
    expect(() => setMediaActionHandler("seekto", () => {})).not.toThrow();
    updateMediaPosition(Infinity, 10);
    updateMediaPosition(0, 0);
    expect(setPositionState).not.toHaveBeenCalled();
    vi.stubGlobal("navigator", {});
    expect(() => updateMediaPosition(180, 10)).not.toThrow();
  });
});
