export type Peak = {
  min: number;
  max: number;
};

type ProgressRenderer = {
  renderProgress: (progress: number, isPlaying?: boolean) => void;
  getWrapper: () => HTMLElement;
};

// wavesurfer rewrites the progress clip, width and cursor position on every animation frame
// while playing, even when the playhead hasn't moved a pixel. Only pass frames through once the
// playhead reaches a new device pixel; paused updates (seeks, drags, loads) always render.
export function limitWaveformProgressRendering(
  renderer: ProgressRenderer,
  getPixelRatio: () => number = () => window.devicePixelRatio || 1,
): () => void {
  const renderProgress = renderer.renderProgress;
  let lastPixel: number | null = null;

  renderer.renderProgress = (progress, isPlaying) => {
    if (isPlaying) {
      const pixel = Math.round(progress * renderer.getWrapper().clientWidth * getPixelRatio());
      if (pixel === lastPixel) return;
      lastPixel = pixel;
    } else {
      lastPixel = null;
    }
    renderProgress.call(renderer, progress, isPlaying);
  };

  return () => {
    renderer.renderProgress = renderProgress;
  };
}

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
