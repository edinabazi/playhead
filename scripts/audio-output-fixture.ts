// Runs in Chromium; no speakers, network, or user library are used.
import { PlaybackAudioEngine } from "../src/renderer/src/features/audio/audio-engine";
import { defaultEqualizerSettings } from "../src/shared/library";
import { getEqualizerResponseDb } from "../src/renderer/src/features/audio/equalizer";
(async () => {
  const results: { rate: number; kind: string; frequency: number; peak: number }[] = [];
  for (const rate of [44100, 48000]) {
    for (const kind of ["tone", "burst", "impulse", "square"]) {
      for (const frequency of [31, 125, 1000, 4000, 16000]) {
        const ctx = new OfflineAudioContext(2, rate, rate);
        const buffer = ctx.createBuffer(2, rate, rate);
        for (let ch = 0; ch < 2; ch++) {
          const samples = buffer.getChannelData(ch);
          for (let i = 0; i < samples.length; i++) {
            const wave = Math.sin((2 * Math.PI * frequency * i) / rate);
            samples[i] =
              (ch ? -1 : 1) *
              (kind === "impulse"
                ? i % 10000 === 5000
                  ? 1
                  : 0
                : kind === "square"
                  ? Math.sign(wave)
                  : kind === "burst"
                    ? i % 10000 > 5000
                      ? wave
                      : 0
                    : wave);
          }
        }
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        Object.assign(ctx, { createMediaElementSource: () => source });
        const engine = new PlaybackAudioEngine(new Audio(), () => ctx as unknown as AudioContext);
        engine.setEqualizer({ preampDb: 12, gainsDb: Array(10).fill(12) });
        engine.setBoostGain(2);
        engine.activate();
        source.start();
        const out = await ctx.startRendering();
        let peak = 0;
        for (let ch = 0; ch < 2; ch++)
          for (const sample of out.getChannelData(ch)) {
            if (!Number.isFinite(sample)) throw Error("nonfinite");
            peak = Math.max(peak, Math.abs(sample));
          }
        if (peak > 10 ** (-1 / 20) + 1e-6)
          throw Error(`Ceiling failed ${kind} ${rate} ${frequency}: ${peak}`);
        results.push({ rate, kind, frequency, peak });
      }
    }
  }
  const response: { frequency: number; gain: number; actual: number; expected: number }[] = [];
  for (const frequency of [100, 1000, 4000])
    for (const gain of [0, 6]) {
      const rate = 48000;
      const ctx = new OfflineAudioContext(1, rate * 2, rate);
      const buffer = ctx.createBuffer(1, rate * 2, rate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++)
        data[i] = 0.001 * Math.sin((2 * Math.PI * frequency * i) / rate);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      Object.assign(ctx, { createMediaElementSource: () => source });
      const engine = new PlaybackAudioEngine(new Audio(), () => ctx as unknown as AudioContext);
      const settings = { ...defaultEqualizerSettings(), enabled: true };
      settings.gainsDb[5] = gain;
      engine.setEqualizer(settings);
      engine.activate();
      source.start();
      const out = (await ctx.startRendering()).getChannelData(0);
      let sum = 0;
      for (let i = rate; i < out.length; i++) sum += out[i] ** 2;
      const actual = 20 * Math.log10(Math.sqrt(sum / rate) / (0.001 / Math.sqrt(2)));
      const expected = getEqualizerResponseDb(settings, frequency, rate);
      if (Math.abs(actual - expected) > 0.05)
        throw Error(`Response ${frequency}: ${actual} vs ${expected}`);
      response.push({ frequency, gain, actual, expected });
    }
  // Switching both effects off must restore unprocessed full-scale samples.
  const bypassContext = new OfflineAudioContext(1, 4800, 48000);
  const bypassBuffer = bypassContext.createBuffer(1, 4800, 48000);
  const bypassInput = bypassBuffer.getChannelData(0);
  for (let i = 0; i < bypassInput.length; i++)
    bypassInput[i] = Math.sin((2 * Math.PI * 1000 * i) / 48000);
  const bypassSource = bypassContext.createBufferSource();
  bypassSource.buffer = bypassBuffer;
  Object.assign(bypassContext, { createMediaElementSource: () => bypassSource });
  const bypassEngine = new PlaybackAudioEngine(
    new Audio(),
    () => bypassContext as unknown as AudioContext,
  );
  bypassEngine.setEqualizer({ preampDb: 12, gainsDb: Array(10).fill(12) });
  bypassEngine.activate();
  bypassEngine.setProcessingEnabled(false);
  bypassSource.start();
  const bypassOutput = (await bypassContext.startRendering()).getChannelData(0);
  for (let i = 0; i < bypassInput.length; i++) {
    if (Math.abs(bypassInput[i] - bypassOutput[i]) > 1e-6) throw Error("Bypass altered audio");
  }
  console.log(
    "DSP_RESULTS " +
      JSON.stringify({
        ceilingCases: results.length,
        bypass: "unchanged",
        maxPeak: Math.max(...results.map((r) => r.peak)),
        response,
      }),
  );
})().catch((e) => console.log("DSP_ERROR " + e.stack));
