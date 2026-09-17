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
  const preamp = node("preamp", { gain: param() });
  let bandCount = 0;
  const createBand = () =>
    node(`band${bandCount++}`, { type: "", frequency: param(), Q: param(), gain: param() });
  const bands: ReturnType<typeof createBand>[] = [];
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
    createGain: vi
      .fn()
      .mockReturnValueOnce(preamp)
      .mockReturnValueOnce(boost)
      .mockReturnValueOnce(makeup),
    createBiquadFilter: vi.fn(() => {
      const band = createBand();
      bands.push(band);
      return band;
    }),
    createDynamicsCompressor: vi.fn(() => limiter),
    resume: vi.fn(async () => {
      context.state = "running";
    }),
    close: vi.fn(async () => undefined),
  };
  return { context, preamp, bands, boost, makeup, limiter, connections };
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

  it("routes source through equalizer, boost and limiter to the output when activated", () => {
    const media = createMedia();
    const { context, preamp, bands, boost, makeup, limiter, connections } = createContext();
    const engine = new PlaybackAudioEngine(
      media as unknown as HTMLMediaElement,
      () => context as unknown as AudioContext,
    );

    engine.setBoostGain(1.4);
    engine.setEqualizer({ preampDb: -6, gainsDb: [3, 0, 0, 0, 0, 0, 0, 0, 0, -9] });
    engine.activate();
    engine.activate();

    expect(context.createMediaElementSource).toHaveBeenCalledTimes(1);
    expect(connections).toEqual([
      "source->preamp",
      "preamp->band0",
      ...Array.from({ length: 9 }, (_, index) => `band${index}->band${index + 1}`),
      "band9->boost",
      "boost->limiter",
      "limiter->makeup",
      "makeup->destination",
    ]);
    expect(preamp.gain.value).toBeCloseTo(0.5012, 4);
    expect(bands.map((band) => [band.type, band.frequency.value, band.Q.value])[5]).toEqual([
      "peaking",
      1000,
      1.41,
    ]);
    expect(bands[0].gain.value).toBe(3);
    expect(bands[9].gain.value).toBe(-9);
    expect(boost.gain.value).toBe(1.4);
    expect(makeup.gain.value).toBeCloseTo(0.9365, 4);
    expect(limiter.threshold.value).toBe(-1);
    expect(limiter.ratio.value).toBe(20);
    expect(engine.getLimiterReduction()).toBe(-3);
  });

  it("smooths boost changes and resumes the context on play", async () => {
    const media = createMedia();
    const { context, preamp, bands, boost } = createContext();
    const engine = new PlaybackAudioEngine(
      media as unknown as HTMLMediaElement,
      () => context as unknown as AudioContext,
    );

    engine.activate();
    engine.setBoostGain(2);
    expect(boost.gain.setTargetAtTime).toHaveBeenCalledWith(2, 12, 0.015);
    engine.setEqualizer({ preampDb: 0, gainsDb: [0, 0, 0, 0, 0, 4, 0, 0, 0, 0] });
    expect(bands[5].gain.setTargetAtTime).toHaveBeenCalledWith(4, 12, 0.015);
    expect(preamp.gain.setTargetAtTime).toHaveBeenCalledWith(1, 12, 0.015);

    media.emit("play");
    await Promise.resolve();
    expect(context.resume).toHaveBeenCalled();

    engine.dispose();
    expect(context.close).toHaveBeenCalled();
    expect(media.removeEventListener).toHaveBeenCalledWith("play", expect.any(Function));
    expect(engine.isActive()).toBe(false);
  });
});
