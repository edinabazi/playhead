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
    disconnect: vi.fn(),
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
  const source = node("source");
  const ceiling = node("ceiling", { curve: null as Float32Array | null });
  const context = {
    state: "suspended",
    currentTime: 12,
    destination: { name: "destination" },
    createMediaElementSource: vi.fn(() => source),
    createWaveShaper: vi.fn(() => ceiling),
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
  return { context, preamp, bands, boost, makeup, limiter, connections, source, ceiling };
}

function createMeter() {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    port: {
      postMessage: vi.fn(),
      close: vi.fn(),
      onmessage: null as ((event: { data: number[] }) => void) | null,
    },
  };
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
      "preamp->band0",
      ...Array.from({ length: 9 }, (_, index) => `band${index}->band${index + 1}`),
      "band9->boost",
      "boost->limiter",
      "limiter->makeup",
      "makeup->ceiling",
      "ceiling->destination",
      "source->preamp",
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

  it("keeps the native output when the graph can't be built", () => {
    const media = createMedia();
    const { context } = createContext();
    context.createDynamicsCompressor = vi.fn(() => {
      throw new Error("unsupported");
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const engine = new PlaybackAudioEngine(
      media as unknown as HTMLMediaElement,
      () => context as unknown as AudioContext,
    );

    engine.activate();
    engine.activate();

    expect(context.createMediaElementSource).not.toHaveBeenCalled();
    expect(context.close).toHaveBeenCalledTimes(1);
    expect(engine.isActive()).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("does not capture media if a downstream connection fails", () => {
    const { context, makeup } = createContext();
    makeup.connect.mockImplementation(() => {
      throw new Error("connection failed");
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const engine = new PlaybackAudioEngine(
      createMedia() as unknown as HTMLMediaElement,
      () => context as unknown as AudioContext,
    );
    engine.activate();
    expect(context.createMediaElementSource).not.toHaveBeenCalled();
    expect(context.close).toHaveBeenCalledOnce();
    expect(engine.isActive()).toBe(false);
    warn.mockRestore();
  });

  it("keeps captured media alive through a direct fallback if its first connection fails", async () => {
    const { context, source } = createContext();
    source.connect.mockImplementationOnce(() => {
      throw new Error("connection failed");
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const engine = new PlaybackAudioEngine(
      createMedia(false) as unknown as HTMLMediaElement,
      () => context as unknown as AudioContext,
    );
    engine.activate();
    await Promise.resolve();
    expect(source.disconnect).toHaveBeenCalledOnce();
    expect(source.connect).toHaveBeenLastCalledWith(context.destination);
    expect(context.close).not.toHaveBeenCalled();
    expect(context.resume).toHaveBeenCalledOnce();
    expect(engine.isActive()).toBe(false);
    engine.dispose();
    expect(context.close).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it("bypasses all effects when disabled and reuses the captured source when re-enabled", () => {
    const { context, source, preamp } = createContext();
    const engine = new PlaybackAudioEngine(
      createMedia() as unknown as HTMLMediaElement,
      () => context as unknown as AudioContext,
    );
    engine.activate();
    engine.setProcessingEnabled(false);
    expect(source.connect).toHaveBeenLastCalledWith(context.destination);
    expect(engine.getLimiterReduction()).toBe(0);
    engine.setProcessingEnabled(true);
    expect(source.connect).toHaveBeenLastCalledWith(preamp);
    expect(context.createMediaElementSource).toHaveBeenCalledOnce();
    expect(source.disconnect).toHaveBeenCalledTimes(2);
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
  it("does not build a meter for ordinary EQ use and attaches it only while requested", async () => {
    const { context, source, ceiling } = createContext();
    const meter = createMeter();
    const factory = vi.fn(async () => meter as unknown as AudioWorkletNode);
    const engine = new PlaybackAudioEngine(
      createMedia() as unknown as HTMLMediaElement,
      () => context as unknown as AudioContext,
      factory,
    );
    engine.setProcessingEnabled(false);
    engine.activate();
    expect(factory).not.toHaveBeenCalled();
    expect(source.connect).toHaveBeenLastCalledWith(context.destination);
    await engine.setMeteringEnabled(true);
    expect(source.connect).toHaveBeenLastCalledWith(meter);
    engine.setProcessingEnabled(true);
    expect(source.disconnect).toHaveBeenCalledWith(meter);
    expect(ceiling.connect).toHaveBeenLastCalledWith(meter);
    await engine.setMeteringEnabled(false);
    expect(ceiling.disconnect).toHaveBeenCalledWith(meter);
    expect(meter.port.postMessage).toHaveBeenLastCalledWith("stop");
    expect(meter.port.close).toHaveBeenCalledOnce();
    expect(context.close).not.toHaveBeenCalled();
    expect(engine.readLevels({ peak: [0, 0] })).toBe(false);
  });

  it("preserves accumulated channel peaks between UI reads", async () => {
    const { context } = createContext();
    const meter = createMeter();
    const engine = new PlaybackAudioEngine(
      createMedia() as unknown as HTMLMediaElement,
      () => context as unknown as AudioContext,
      async () => meter as unknown as AudioWorkletNode,
    );
    await engine.setMeteringEnabled(true);
    meter.port.onmessage?.({ data: [0.75, 0.1] });
    meter.port.onmessage?.({ data: [0.1, 0.5] });
    const target = { peak: [0, 0] as [number, number] };
    expect(engine.readLevels(target)).toBe(true);
    expect(target.peak).toEqual([0.75, 0.5]);
    engine.readLevels(target);
    expect(target.peak).toEqual([0, 0]);
    engine.dispose();
    expect(meter.disconnect).toHaveBeenCalledOnce();
  });

  it.each(["close", "dispose"])(
    "does not attach a late-loading worklet after %s",
    async (action) => {
      const { context } = createContext();
      const meter = createMeter();
      let resolve!: (node: AudioWorkletNode) => void;
      const engine = new PlaybackAudioEngine(
        createMedia() as unknown as HTMLMediaElement,
        () => context as unknown as AudioContext,
        () =>
          new Promise((done) => {
            resolve = done;
          }),
      );
      const pending = engine.setMeteringEnabled(true);
      if (action === "dispose") engine.dispose();
      else await engine.setMeteringEnabled(false);
      resolve(meter as unknown as AudioWorkletNode);
      await pending;
      expect(meter.connect).not.toHaveBeenCalled();
      expect(meter.port.postMessage).toHaveBeenCalledWith("stop");
      expect(meter.port.close).toHaveBeenCalledOnce();
    },
  );

  it("leaves playback intact when the meter module fails to load", async () => {
    const { context, source } = createContext();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const engine = new PlaybackAudioEngine(
        createMedia() as unknown as HTMLMediaElement,
        () => context as unknown as AudioContext,
        async () => {
          throw Error("module unavailable");
        },
      );
      engine.setProcessingEnabled(false);
      await engine.setMeteringEnabled(true);
      expect(source.connect).toHaveBeenLastCalledWith(context.destination);
      expect(context.close).not.toHaveBeenCalled();
      expect(engine.readLevels({ peak: [0, 0] })).toBe(false);
    } finally {
      warn.mockRestore();
    }
  });
});
