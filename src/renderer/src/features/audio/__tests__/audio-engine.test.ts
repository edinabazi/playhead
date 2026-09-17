import { describe, expect, it, vi } from "vitest";
import { PlaybackAudioEngine } from "../audio-engine";

function createMedia(paused = true) {
  const listeners = new Map<string, () => void>();
  return {
    crossOrigin: null as string | null,
    paused,
    addEventListener: vi.fn((type: string, listener: () => void) => listeners.set(type, listener)),
    removeEventListener: vi.fn((type: string) => listeners.delete(type)),
    emit: (type: string) => listeners.get(type)?.(),
  };
}

function createContext() {
  const connections: string[] = [];
  const node = <T extends object>(name: string, extra = {} as T) => ({
    name,
    connect: vi.fn((target: { name: string }) => {
      connections.push(`${name}->${target.name}`);
      return target;
    }),
    ...extra,
  });
  const param = () => ({ value: 0, setTargetAtTime: vi.fn() });
  const boost = node("boost", { gain: param() });
  const makeup = node("makeup", { gain: param() });
  const limiter = node("limiter", {
    threshold: param(),
    knee: param(),
    ratio: param(),
    attack: param(),
    release: param(),
    reduction: -3,
  });
  const context = {
    state: "suspended",
    currentTime: 12,
    destination: { name: "destination" },
    createMediaElementSource: vi.fn(() => node("source")),
    createGain: vi.fn().mockReturnValueOnce(boost).mockReturnValueOnce(makeup),
    createDynamicsCompressor: vi.fn(() => limiter),
    resume: vi.fn(async () => {
      context.state = "running";
    }),
    close: vi.fn(async () => undefined),
  };
  return { context, boost, makeup, limiter, connections };
}

describe("PlaybackAudioEngine", () => {
  it("prepares the media element for Web Audio without building the graph", () => {
    const media = createMedia();
    const factory = vi.fn();
    const engine = new PlaybackAudioEngine(media as unknown as HTMLMediaElement, factory);

    expect(media.crossOrigin).toBe("anonymous");
    expect(engine.isActive()).toBe(false);
    expect(engine.getLimiterReduction()).toBe(0);
    engine.setBoostGain(1.5);
    expect(factory).not.toHaveBeenCalled();
  });

  it("routes source through boost and limiter to the output when activated", () => {
    const media = createMedia();
    const { context, boost, makeup, limiter, connections } = createContext();
    const engine = new PlaybackAudioEngine(
      media as unknown as HTMLMediaElement,
      () => context as unknown as AudioContext,
    );

    engine.setBoostGain(1.4);
    engine.activate();
    engine.activate();

    expect(context.createMediaElementSource).toHaveBeenCalledTimes(1);
    expect(connections).toEqual([
      "source->boost",
      "boost->limiter",
      "limiter->makeup",
      "makeup->destination",
    ]);
    expect(boost.gain.value).toBe(1.4);
    expect(makeup.gain.value).toBeCloseTo(0.9365, 4);
    expect(limiter.threshold.value).toBe(-1);
    expect(limiter.ratio.value).toBe(20);
    expect(engine.getLimiterReduction()).toBe(-3);
  });

  it("smooths boost changes and resumes the context on play", async () => {
    const media = createMedia();
    const { context, boost } = createContext();
    const engine = new PlaybackAudioEngine(
      media as unknown as HTMLMediaElement,
      () => context as unknown as AudioContext,
    );

    engine.activate();
    engine.setBoostGain(2);
    expect(boost.gain.setTargetAtTime).toHaveBeenCalledWith(2, 12, 0.015);

    media.emit("play");
    await Promise.resolve();
    expect(context.resume).toHaveBeenCalled();

    engine.dispose();
    expect(context.close).toHaveBeenCalled();
    expect(media.removeEventListener).toHaveBeenCalledWith("play", expect.any(Function));
    expect(engine.isActive()).toBe(false);
  });
});
