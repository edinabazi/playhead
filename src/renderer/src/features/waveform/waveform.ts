export type Peak = {
  min: number;
  max: number;
};

export function getWaveformProgress(currentTime: number, duration: number): number {
  if (!Number.isFinite(currentTime) || !Number.isFinite(duration) || duration <= 0) return 0;
  return Math.min(1, Math.max(0, currentTime / duration));
}

export function buildPeaks(buffer: AudioBuffer, width: number, duration = buffer.duration): Peak[] {
  const peakCount = Math.max(1, Math.floor(width));
  const sampleLength =
    Number.isFinite(duration) && duration > 0
      ? Math.min(buffer.length, Math.max(1, Math.round(duration * buffer.sampleRate)))
      : buffer.length;
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) =>
    buffer.getChannelData(index),
  );
  const peaks: Peak[] = [];
  let largest = 0;

  for (let i = 0; i < peakCount; i += 1) {
    const start = Math.floor((i * sampleLength) / peakCount);
    const end = Math.max(start + 1, Math.floor(((i + 1) * sampleLength) / peakCount));
    let min = 0;
    let max = 0;

    for (let sampleIndex = start; sampleIndex < Math.min(end, sampleLength); sampleIndex += 1) {
      let sample = 0;

      for (const channel of channels) sample += channel[sampleIndex] ?? 0;
      sample /= channels.length;

      if (sample < min) min = sample;
      if (sample > max) max = sample;
    }

    largest = Math.max(largest, Math.abs(min), Math.abs(max));
    peaks.push({ min, max });
  }

  if (largest === 0) return peaks;

  return peaks.map((peak) => ({
    min: peak.min / largest,
    max: peak.max / largest,
  }));
}

export function getCssColor(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function toArrayBuffer(value: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (value instanceof ArrayBuffer) return value;
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy.buffer;
}
