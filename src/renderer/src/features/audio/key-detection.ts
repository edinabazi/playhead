// Musical key from a decoded track: a chromagram (energy per pitch class) correlated with the
// Krumhansl–Kessler major and minor key profiles. Results use Camelot notation for DJ mixing.

const pitchNames = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const majorProfile = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const minorProfile = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
// Camelot wheel number for each tonic pitch class.
const camelotMajor = [8, 3, 10, 5, 12, 7, 2, 9, 4, 11, 6, 1];
const camelotMinor = [5, 12, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10];

const frameSize = 4096;
const minFrequency = 55;
const maxFrequency = 1760;
// Enough music to settle the key without analysing whole DJ mixes.
const maxAnalysisSeconds = 120;

export type MusicalKey = { tonic: number; mode: "major" | "minor"; camelot: string; name: string };

export function describeKey(tonic: number, mode: "major" | "minor"): MusicalKey {
  const camelot = `${mode === "major" ? camelotMajor[tonic] : camelotMinor[tonic]}${mode === "major" ? "B" : "A"}`;
  const name = `${pitchNames[tonic]}${mode === "minor" ? "m" : ""}`;
  return { tonic, mode, camelot, name };
}

/** Text shown in the Key column, e.g. "8A · Am". */
export function formatMusicalKey(key: MusicalKey): string {
  return `${key.camelot} · ${key.name}`;
}

function fft(real: Float64Array, imag: Float64Array) {
  const n = real.length;
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]];
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const angle = (-2 * Math.PI) / size;
    const stepReal = Math.cos(angle);
    const stepImag = Math.sin(angle);
    for (let start = 0; start < n; start += size) {
      let wReal = 1;
      let wImag = 0;
      for (let k = 0; k < size / 2; k += 1) {
        const even = start + k;
        const odd = even + size / 2;
        const tReal = real[odd] * wReal - imag[odd] * wImag;
        const tImag = real[odd] * wImag + imag[odd] * wReal;
        real[odd] = real[even] - tReal;
        imag[odd] = imag[even] - tImag;
        real[even] += tReal;
        imag[even] += tImag;
        const nextReal = wReal * stepReal - wImag * stepImag;
        wImag = wReal * stepImag + wImag * stepReal;
        wReal = nextReal;
      }
    }
  }
}

export function chromagram(samples: Float32Array, sampleRate: number): number[] {
  const chroma = new Array<number>(12).fill(0);
  const window = new Float64Array(frameSize);
  for (let i = 0; i < frameSize; i += 1)
    window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / frameSize);

  // Map each FFT bin in range to its pitch class once.
  const binPitch = new Int8Array(frameSize / 2).fill(-1);
  for (let bin = 1; bin < frameSize / 2; bin += 1) {
    const frequency = (bin * sampleRate) / frameSize;
    if (frequency < minFrequency || frequency > maxFrequency) continue;
    const midi = Math.round(12 * Math.log2(frequency / 440) + 69);
    binPitch[bin] = ((midi % 12) + 12) % 12;
  }

  const real = new Float64Array(frameSize);
  const imag = new Float64Array(frameSize);
  for (let start = 0; start + frameSize <= samples.length; start += frameSize) {
    for (let i = 0; i < frameSize; i += 1) {
      real[i] = samples[start + i] * window[i];
      imag[i] = 0;
    }
    fft(real, imag);
    for (let bin = 1; bin < frameSize / 2; bin += 1) {
      const pitch = binPitch[bin];
      if (pitch >= 0) chroma[pitch] += Math.hypot(real[bin], imag[bin]);
    }
  }
  return chroma;
}

function correlation(a: number[], b: number[]) {
  const meanA = a.reduce((sum, value) => sum + value, 0) / a.length;
  const meanB = b.reduce((sum, value) => sum + value, 0) / b.length;
  let numerator = 0;
  let varianceA = 0;
  let varianceB = 0;
  for (let i = 0; i < a.length; i += 1) {
    numerator += (a[i] - meanA) * (b[i] - meanB);
    varianceA += (a[i] - meanA) ** 2;
    varianceB += (b[i] - meanB) ** 2;
  }
  return varianceA && varianceB ? numerator / Math.sqrt(varianceA * varianceB) : 0;
}

export function keyFromChroma(chroma: number[]): MusicalKey | null {
  if (chroma.every((value) => value === 0)) return null;
  let best: { score: number; tonic: number; mode: "major" | "minor" } | null = null;
  for (let tonic = 0; tonic < 12; tonic += 1) {
    // Rotate the chroma so the candidate tonic lines up with the profile's first entry.
    const rotated = chroma.map((_, index) => chroma[(index + tonic) % 12]);
    for (const [mode, profile] of [
      ["major", majorProfile],
      ["minor", minorProfile],
    ] as const) {
      const score = correlation(rotated, profile);
      if (!best || score > best.score) best = { score, tonic, mode };
    }
  }
  return best ? describeKey(best.tonic, best.mode) : null;
}

export function detectKeyFromBuffer(buffer: AudioBuffer): MusicalKey | null {
  const { sampleRate, numberOfChannels } = buffer;
  const analysisLength = Math.min(buffer.length, Math.floor(maxAnalysisSeconds * sampleRate));
  // Take the middle of long tracks; intros and outros are often sparse or beatless.
  const offset = Math.floor((buffer.length - analysisLength) / 2);
  const mono = new Float32Array(analysisLength);
  for (let channel = 0; channel < numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < analysisLength; i += 1) mono[i] += data[offset + i] / numberOfChannels;
  }
  return keyFromChroma(chromagram(mono, sampleRate));
}
