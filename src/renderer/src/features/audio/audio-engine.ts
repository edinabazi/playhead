type AudioContextFactory = () => AudioContext;

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

// Routes the player's media element through Web Audio. The graph is built lazily because a
// media element can't be detached from Web Audio once connected, so listeners who never use
// audio features keep the browser's native output path.
export class PlaybackAudioEngine {
  private context: AudioContext | null = null;
  private boostNode: GainNode | null = null;
  private limiterNode: DynamicsCompressorNode | null = null;
  private boostGain = 1;
  private readonly resumeOnPlay = () => {
    void this.resume();
  };

  constructor(
    private readonly media: HTMLMediaElement,
    private readonly createContext: AudioContextFactory = () => new AudioContext(),
  ) {
    media.crossOrigin = "anonymous";
    media.addEventListener("play", this.resumeOnPlay);
  }

  isActive(): boolean {
    return this.context !== null;
  }

  activate(): void {
    if (this.context) return;

    const context = this.createContext();
    const source = context.createMediaElementSource(this.media);
    const boost = context.createGain();
    const limiter = context.createDynamicsCompressor();
    const makeupCompensation = context.createGain();
    boost.gain.value = this.boostGain;
    makeupCompensation.gain.value = limiterMakeupCompensation;
    limiter.threshold.value = limiterSettings.threshold;
    limiter.knee.value = limiterSettings.knee;
    limiter.ratio.value = limiterSettings.ratio;
    limiter.attack.value = limiterSettings.attack;
    limiter.release.value = limiterSettings.release;
    source.connect(boost);
    boost.connect(limiter);
    limiter.connect(makeupCompensation);
    makeupCompensation.connect(context.destination);

    this.context = context;
    this.boostNode = boost;
    this.limiterNode = limiter;
    if (!this.media.paused) void this.resume();
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

  getLimiterReduction(): number {
    return this.limiterNode?.reduction ?? 0;
  }

  async resume(): Promise<void> {
    if (this.context?.state !== "suspended") return;
    await this.context.resume().catch(() => undefined);
  }

  dispose(): void {
    this.media.removeEventListener("play", this.resumeOnPlay);
    void this.context?.close().catch(() => undefined);
    this.context = null;
    this.boostNode = null;
    this.limiterNode = null;
  }
}
