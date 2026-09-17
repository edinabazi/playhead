import { describe, expect, it, vi } from "vitest";
import { limitWaveformProgressRendering } from "../waveform";

function createRenderer(width: number) {
  const calls: [number, boolean | undefined][] = [];
  const renderer = {
    renderProgress: vi.fn((progress: number, isPlaying?: boolean) => {
      calls.push([progress, isPlaying]);
    }),
    getWrapper: () => ({ clientWidth: width }) as HTMLElement,
  };
  return { renderer, calls };
}

describe("limitWaveformProgressRendering", () => {
  it("skips playing frames until the playhead reaches a new device pixel", () => {
    const { renderer, calls } = createRenderer(500);
    limitWaveformProgressRendering(renderer, () => 2);

    renderer.renderProgress(0.1, true);
    renderer.renderProgress(0.1002, true);
    renderer.renderProgress(0.1004, true);
    renderer.renderProgress(0.1012, true);

    expect(calls.map(([progress]) => progress)).toEqual([0.1, 0.1012]);
  });

  it("always renders paused updates and restores the original method", () => {
    const { renderer, calls } = createRenderer(500);
    const original = renderer.renderProgress;
    const restore = limitWaveformProgressRendering(renderer, () => 2);

    renderer.renderProgress(0.3, false);
    renderer.renderProgress(0.3, false);
    renderer.renderProgress(0.3, true);
    renderer.renderProgress(0.3, true);
    expect(calls).toHaveLength(3);

    restore();
    expect(renderer.renderProgress).toBe(original);
  });
});
