import { analyze } from "web-audio-beat-detector";
import type { LibraryTrack } from "../../../../shared/library";

export const waveformAnalysisPeakRate = 20;
export const waveformAnalysisMaxPeaks = 24_000;

export function shouldAnalyzeTrackBpm(track: LibraryTrack): boolean {
  if (!track.bpm) return true;
  return track.bpmSource === "analysis";
}

export async function decodeAudioTrack(
  track: LibraryTrack,
  readAudioFile: (path: string) => Promise<ArrayBuffer>,
): Promise<AudioBuffer> {
  const bytes = await readAudioFile(track.path);
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
  const tempo = await analyze(buffer);
  const bpm = Math.round(tempo);
  if (!Number.isFinite(bpm) || bpm <= 0) throw new Error("BPM could not be detected.");
  return { bpm, tempo };
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
