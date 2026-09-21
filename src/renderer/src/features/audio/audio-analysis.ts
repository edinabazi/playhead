import type { LibraryTrack } from "../../../../shared/library";

export const waveformAnalysisPeakRate = 20;
export const waveformAnalysisMaxPeaks = 24_000;
export const volumeNormalizationTargetLoudnessDb = -18;
export const volumeNormalizationBoostedMaxGainDb = 6;

const loudnessAbsoluteGateDb = -70;
const loudnessOffsetDb = -0.691;
const loudnessRelativeGateDb = 10;
const volumeNormalizationMinGainDb = -12;
const volumeNormalizationMaxGainDb = 0;

export function shouldAnalyzeTrackBpm(track: LibraryTrack): boolean {
  if (!track.bpm) return true;
  return track.bpmSource === "analysis";
}

export async function decodeAudioTrack(
  track: LibraryTrack,
  readAudioFile: (path: string) => Promise<ArrayBuffer>,
): Promise<AudioBuffer> {
  const bytes = await readAudioFile(track.path);
  return decodeAudioBytes(bytes);
}

export async function decodeAudioBytes(bytes: ArrayBuffer): Promise<AudioBuffer> {
  const audioContext = new AudioContext({ sampleRate: 16000 });

  try {
    return await audioContext.decodeAudioData(bytes.slice(0));
  } finally {
    await audioContext.close();
  }
}

export async function analyzeBpmFromBuffer(buffer: AudioBuffer): Promise<{
  bpm: number;
  tempo: number;
}> {
  const { analyze } = await import("web-audio-beat-detector");
  const tempo = await analyze(buffer);
  const bpm = Math.round(tempo);
  if (!Number.isFinite(bpm) || bpm <= 0) throw new Error("BPM could not be detected.");
  return { bpm, tempo };
}

function energyToLoudnessDb(energy: number): number {
  return loudnessOffsetDb + 10 * Math.log10(energy);
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

type BiquadCoefficients = {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
};

function createDeManHighShelf(sampleRate: number): BiquadCoefficients {
  const gainDb = 3.99984385397;
  const quality = 0.7071752369554193;
  const frequency = 1681.9744509555319;
  const k = Math.tan((Math.PI * frequency) / sampleRate);
  const highGain = 10 ** (gainDb / 20);
  const bandGain = highGain ** 0.499666774155;
  const denominator = 1 + k / quality + k * k;

  return {
    b0: (highGain + (bandGain * k) / quality + k * k) / denominator,
    b1: (2 * (k * k - highGain)) / denominator,
    b2: (highGain - (bandGain * k) / quality + k * k) / denominator,
    a1: (2 * (k * k - 1)) / denominator,
    a2: (1 - k / quality + k * k) / denominator,
  };
}

function createDeManHighPass(sampleRate: number): BiquadCoefficients {
  const quality = 0.5003270373253953;
  const frequency = 38.13547087613982;
  const k = Math.tan((Math.PI * frequency) / sampleRate);
  const denominator = 1 + k / quality + k * k;

  return {
    b0: 1,
    b1: -2,
    b2: 1,
    a1: (2 * (k * k - 1)) / denominator,
    a2: (1 - k / quality + k * k) / denominator,
  };
}

function createBiquad(coefficients: BiquadCoefficients): (sample: number) => number {
  let input1 = 0;
  let input2 = 0;
  let output1 = 0;
  let output2 = 0;

  return (sample) => {
    const output =
      coefficients.b0 * sample +
      coefficients.b1 * input1 +
      coefficients.b2 * input2 -
      coefficients.a1 * output1 -
      coefficients.a2 * output2;
    input2 = input1;
    input1 = sample;
    output2 = output1;
    output1 = output;
    return output;
  };
}

function getBs1770ChannelWeights(channelCount: number): number[] {
  if (channelCount === 4) return [1, 1, 1.41, 1.41];
  if (channelCount === 5) return [1, 1, 1, 1.41, 1.41];
  if (channelCount === 6) return [1, 1, 1, 0, 1.41, 1.41];
  if (channelCount === 7) return [1, 1, 1, 0, 1.41, 1.41, 1.41];
  if (channelCount === 8) return [1, 1, 1, 0, 1.41, 1.41, 1.41, 1.41];
  return Array.from({ length: channelCount }, () => 1);
}

export function estimateIntegratedLoudnessDb(buffer: AudioBuffer): number | null {
  if (!buffer.numberOfChannels || !buffer.length || !buffer.sampleRate) return null;

  const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) =>
    buffer.getChannelData(index),
  );
  const stepLength = Math.max(1, Math.round(buffer.sampleRate * 0.1));
  const blockLength = stepLength * 4;
  if (buffer.length < blockLength) return null;
  const segmentCount = Math.ceil(buffer.length / stepLength);
  const segmentEnergies = new Float64Array(segmentCount);
  const channelWeights = getBs1770ChannelWeights(buffer.numberOfChannels);

  for (let channelIndex = 0; channelIndex < channels.length; channelIndex += 1) {
    const highShelf = createBiquad(createDeManHighShelf(buffer.sampleRate));
    const highPass = createBiquad(createDeManHighPass(buffer.sampleRate));
    const channel = channels[channelIndex];
    const channelWeight = channelWeights[channelIndex] ?? 1;

    for (let sampleIndex = 0; sampleIndex < buffer.length; sampleIndex += 1) {
      const weightedSample = highPass(highShelf(channel[sampleIndex] ?? 0));
      const segmentIndex = Math.floor(sampleIndex / stepLength);
      segmentEnergies[segmentIndex] += channelWeight * weightedSample * weightedSample;
    }
  }

  const blockEnergies: number[] = [];

  for (let start = 0; start + blockLength <= buffer.length; start += stepLength) {
    const firstSegment = Math.floor(start / stepLength);
    let energy = 0;
    for (let offset = 0; offset < 4; offset += 1) {
      energy += segmentEnergies[firstSegment + offset] ?? 0;
    }
    const meanSquare = energy / blockLength;
    if (
      meanSquare > 0 &&
      Number.isFinite(meanSquare) &&
      energyToLoudnessDb(meanSquare) >= loudnessAbsoluteGateDb
    ) {
      blockEnergies.push(meanSquare);
    }
  }

  if (blockEnergies.length === 0) return null;

  const ungatedLoudnessDb = energyToLoudnessDb(average(blockEnergies));
  const relativeGateDb = Math.max(
    loudnessAbsoluteGateDb,
    ungatedLoudnessDb - loudnessRelativeGateDb,
  );
  const gatedEnergies = blockEnergies.filter(
    (energy) => energyToLoudnessDb(energy) >= relativeGateDb,
  );
  if (gatedEnergies.length === 0) return null;

  const loudnessDb = energyToLoudnessDb(average(gatedEnergies));
  return Number.isFinite(loudnessDb) ? loudnessDb : null;
}

export function getLoudnessNormalizationGain(
  loudnessDb: number,
  targetLoudnessDb = volumeNormalizationTargetLoudnessDb,
  maxGainDb = volumeNormalizationMaxGainDb,
): number {
  if (!Number.isFinite(loudnessDb) || !Number.isFinite(targetLoudnessDb)) return 1;

  const gainDb = Math.min(
    maxGainDb,
    Math.max(volumeNormalizationMinGainDb, targetLoudnessDb - loudnessDb),
  );
  return 10 ** (gainDb / 20);
}

export function getWaveformAnalysisPeakCount(duration: number): number {
  const sanitizedDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  return Math.max(
    1,
    Math.min(waveformAnalysisMaxPeaks, Math.ceil(sanitizedDuration * waveformAnalysisPeakRate)),
  );
}

export function buildWaveformCachePeaks(
  buffer: AudioBuffer,
  duration = buffer.duration,
): number[][] {
  const peakCount = getWaveformAnalysisPeakCount(duration);
  const sampleLength =
    Number.isFinite(duration) && duration > 0
      ? Math.min(buffer.length, Math.max(1, Math.round(duration * buffer.sampleRate)))
      : buffer.length;
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) =>
    buffer.getChannelData(index),
  );
  const peaks: number[] = [];
  let largest = 0;

  for (let peakIndex = 0; peakIndex < peakCount; peakIndex += 1) {
    const start = Math.floor((peakIndex * sampleLength) / peakCount);
    const end = Math.max(start + 1, Math.floor(((peakIndex + 1) * sampleLength) / peakCount));
    let strongestSample = 0;

    for (let sampleIndex = start; sampleIndex < Math.min(end, sampleLength); sampleIndex += 1) {
      let sample = 0;
      for (const channel of channels) sample += channel[sampleIndex] ?? 0;
      sample /= channels.length || 1;

      if (Math.abs(sample) > Math.abs(strongestSample)) strongestSample = sample;
    }

    largest = Math.max(largest, Math.abs(strongestSample));
    peaks.push(strongestSample);
  }

  if (largest === 0) return [peaks];
  return [peaks.map((peak) => peak / largest)];
}
