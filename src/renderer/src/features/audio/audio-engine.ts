import meterWorkletUrl from "./level-meter.worklet.js?url&no-inline";
import { equalizerBandFrequencies, equalizerBandQ } from "./equalizer";

type AudioContextFactory = () => AudioContext;
type MeterNodeFactory = (context: AudioContext) => Promise<AudioWorkletNode>;

export type ChannelLevels = { peak: [number, number] };

export type EqualizerGains = {
  preampDb: number;
  gainsDb: number[];
};

const limiterSettings = {
  threshold: -1,
  knee: 0,
  ratio: 20,
  attack: 0.001,
  release: 0.1,
};
const gainSmoothingSeconds = 0.015;
// DynamicsCompressorNode adds automatic makeup gain derived from its curve (Web Audio spec:
// full-range gain ^ 0.6), which would make 100% louder once the graph is active. Undo it.
const limiterMakeupCompensation = Math.pow(
  10,
  (limiterSettings.threshold * (1 - 1 / limiterSettings.ratio) * 0.6) / 20,
);

function dbToGain(gainDb: number): number {
  return Number.isFinite(gainDb) ? 10 ** (gainDb / 20) : 1;
}

// Routes the player's media element through Web Audio. The graph is built lazily because a
// media element can't be detached from Web Audio once connected, so listeners who never use
// audio features keep the browser's native output path.
export class PlaybackAudioEngine {
  private context: AudioContext | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private processingEnabled = true;
  private outputNode: AudioNode | null = null;
  private meterNode: AudioWorkletNode | null = null;
  private meterTap: AudioNode | null = null;
  private meterEnabled = false;
  private meterGeneration = 0;
  private meterModule: Promise<void> | null = null;
  private meterPeaks: [number, number] = [0, 0];
  private preampNode: GainNode | null = null;
  private bandNodes: BiquadFilterNode[] = [];
  private boostNode: GainNode | null = null;
  private limiterNode: DynamicsCompressorNode | null = null;
  private activationFailed = false;
  private boostGain = 1;
  private equalizer: EqualizerGains = {
    preampDb: 0,
    gainsDb: equalizerBandFrequencies.map(() => 0),
  };
  private readonly resumeOnPlay = () => {
    void this.resume();
  };

  constructor(
    private readonly media: HTMLMediaElement,
    private readonly createContext: AudioContextFactory = () => new AudioContext(),
    private readonly createMeterNode: MeterNodeFactory = async (context) => {
      this.meterModule ??= context.audioWorklet.addModule(meterWorkletUrl);
      await this.meterModule;
      return new AudioWorkletNode(context, "playhead-level-meter", {
        channelCount: 2,
        channelCountMode: "explicit",
        channelInterpretation: "speakers",
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
      });
    },
  ) {
    media.crossOrigin = "anonymous";
    media.addEventListener("play", this.resumeOnPlay);
  }

  isActive(): boolean {
    return this.context !== null && !this.activationFailed;
  }

  activate(): void {
    if (this.context || this.activationFailed) return;

    let context: AudioContext | null = null;
    let source: MediaElementAudioSourceNode | null = null;
    try {
      context = this.createContext();
      const graphContext = context;
      const preamp = graphContext.createGain();
      const bands = equalizerBandFrequencies.map((frequency, index) => {
        const band = graphContext.createBiquadFilter();
        band.type = "peaking";
        band.frequency.value = frequency;
        band.Q.value = equalizerBandQ;
        band.gain.value = this.equalizer.gainsDb[index] ?? 0;
        return band;
      });
      const boost = graphContext.createGain();
      const limiter = graphContext.createDynamicsCompressor();
      const makeupCompensation = graphContext.createGain();
      // The compressor has a finite ratio and is not a brick-wall limiter. Guard the
      // final samples against overshoot at extreme EQ/boost settings, without changing
      // samples below the -1 dBFS ceiling. Do not oversample: interpolation can overshoot.
      const ceiling = graphContext.createWaveShaper();
      const peakLimit = 10 ** (-1 / 20);
      ceiling.curve = Float32Array.from({ length: 8193 }, (_, index) =>
        Math.max(-peakLimit, Math.min(peakLimit, (index / 8192) * 2 - 1)),
      );
      preamp.gain.value = dbToGain(this.equalizer.preampDb);
      boost.gain.value = this.boostGain;
      makeupCompensation.gain.value = limiterMakeupCompensation;
      limiter.threshold.value = limiterSettings.threshold;
      limiter.knee.value = limiterSettings.knee;
      limiter.ratio.value = limiterSettings.ratio;
      limiter.attack.value = limiterSettings.attack;
      limiter.release.value = limiterSettings.release;

      const lastBand = bands.reduce<AudioNode>((previous, band) => {
        previous.connect(band);
        return band;
      }, preamp);
      lastBand.connect(boost);
      boost.connect(limiter);
      limiter.connect(makeupCompensation);
      makeupCompensation.connect(ceiling);
      ceiling.connect(graphContext.destination);

      // All potentially failing graph construction happens before irreversible media capture.
      source = graphContext.createMediaElementSource(this.media);
      source.connect(this.processingEnabled ? preamp : graphContext.destination);
      this.sourceNode = source;
      this.outputNode = ceiling;

      this.preampNode = preamp;
      this.bandNodes = bands;
      this.boostNode = boost;
      this.limiterNode = limiter;
      this.context = graphContext;
    } catch (error) {
      this.activationFailed = true;
      if (source && context) {
        // Media capture cannot be undone. Keep its context alive and bypass failed effects.
        try {
          source.disconnect();
          source.connect(context.destination);
          this.context = context;
          if (!this.media.paused) void this.resume();
          console.warn("Audio effects unavailable; using direct playback.", error);
        } catch (fallbackError) {
          console.error("Could not restore audio after media capture.", fallbackError);
          void context.close().catch(() => undefined);
        }
      } else {
        console.warn(
          "Could not build the audio graph. Playback stays on the native output.",
          error,
        );
        void context?.close().catch(() => undefined);
      }
      return;
    }

    if (!this.media.paused) void this.resume();
  }

  setProcessingEnabled(enabled: boolean): void {
    if (enabled === this.processingEnabled) return;
    this.processingEnabled = enabled;
    if (!this.sourceNode || !this.context || !this.preampNode) return;
    // A captured media element cannot return to native playback, but it can bypass
    // every effect, including the compressor/ceiling, when both switches are off.
    this.disconnectMeterTap();
    this.sourceNode.disconnect();
    this.sourceNode.connect(enabled ? this.preampNode : this.context.destination);
    this.connectMeterTap();
  }

  setBoostGain(gain: number): void {
    this.boostGain = Number.isFinite(gain) ? Math.max(0, gain) : 1;
    if (!this.context || !this.boostNode) return;
    this.boostNode.gain.setTargetAtTime(
      this.boostGain,
      this.context.currentTime,
      gainSmoothingSeconds,
    );
  }

  setEqualizer(equalizer: EqualizerGains): void {
    this.equalizer = { preampDb: equalizer.preampDb, gainsDb: equalizer.gainsDb.slice() };
    if (!this.context || !this.preampNode) return;

    const now = this.context.currentTime;
    this.preampNode.gain.setTargetAtTime(
      dbToGain(this.equalizer.preampDb),
      now,
      gainSmoothingSeconds,
    );
    this.bandNodes.forEach((band, index) => {
      band.gain.setTargetAtTime(this.equalizer.gainsDb[index] ?? 0, now, gainSmoothingSeconds);
    });
  }

  async setMeteringEnabled(enabled: boolean): Promise<void> {
    if (enabled === this.meterEnabled) return;
    this.meterEnabled = enabled;
    const generation = ++this.meterGeneration;
    this.releaseMeter();
    if (!enabled) return;
    this.activate();
    const context = this.context;
    if (!this.isActive() || !context) return;
    try {
      const node = await this.createMeterNode(context);
      if (!this.meterEnabled || generation !== this.meterGeneration || context !== this.context) {
        node.port.postMessage("stop");
        node.port.close();
        node.disconnect();
        return;
      }
      this.meterNode = node;
      node.port.onmessage = (event: MessageEvent<number[]>) => {
        if (this.meterNode !== node) return;
        for (let channel = 0; channel < 2; channel++) {
          const peak = event.data[channel];
          if (Number.isFinite(peak))
            this.meterPeaks[channel] = Math.max(this.meterPeaks[channel], peak);
        }
      };
      // The meter's output is silence; connecting it keeps the analysis branch rendering.
      node.connect(context.destination);
      this.connectMeterTap();
    } catch (error) {
      if (generation !== this.meterGeneration) return;
      this.releaseMeter();
      this.meterEnabled = false;
      console.warn("Level meter unavailable; playback is unchanged.", error);
    }
  }

  readLevels(target: ChannelLevels): boolean {
    if (!this.meterNode) return false;
    target.peak[0] = this.meterPeaks[0];
    target.peak[1] = this.meterPeaks[1];
    this.meterPeaks = [0, 0];
    this.meterNode.port.postMessage(null);
    return true;
  }

  private connectMeterTap(): void {
    const tap = this.processingEnabled ? this.outputNode : this.sourceNode;
    if (!tap || !this.meterNode) return;
    tap.connect(this.meterNode);
    this.meterTap = tap;
  }

  private disconnectMeterTap(): void {
    if (this.meterTap && this.meterNode) this.meterTap.disconnect(this.meterNode);
    this.meterTap = null;
  }

  private releaseMeter(): void {
    this.disconnectMeterTap();
    if (this.meterNode) {
      this.meterNode.port.onmessage = null;
      this.meterNode.port.postMessage("stop");
      this.meterNode.port.close();
      this.meterNode.disconnect();
      this.meterNode = null;
    }
    this.meterPeaks = [0, 0];
  }

  getLimiterReduction(): number {
    return this.processingEnabled ? (this.limiterNode?.reduction ?? 0) : 0;
  }

  async resume(): Promise<void> {
    if (this.context?.state !== "suspended") return;
    await this.context.resume().catch(() => undefined);
  }

  dispose(): void {
    this.meterEnabled = false;
    this.meterGeneration++;
    this.releaseMeter();
    this.media.removeEventListener("play", this.resumeOnPlay);
    void this.context?.close().catch(() => undefined);
    this.context = null;
    this.sourceNode = null;
    this.outputNode = null;
    this.meterModule = null;
    this.preampNode = null;
    this.bandNodes = [];
    this.boostNode = null;
    this.limiterNode = null;
  }
}
