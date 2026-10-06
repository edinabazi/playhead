import { describe, expect, it } from "vitest";
import { chromagram, describeKey, keyFromChroma } from "../key-detection";

const sampleRate = 16_000;

// A few seconds of a chord progression, built from MIDI note numbers.
function render(chords: number[][], secondsPerChord = 1.5) {
  const perChord = Math.floor(sampleRate * secondsPerChord);
  const samples = new Float32Array(perChord * chords.length);
  chords.forEach((notes, chordIndex) => {
    for (const note of notes) {
      const frequency = 440 * 2 ** ((note - 69) / 12);
      for (let i = 0; i < perChord; i += 1) {
        samples[chordIndex * perChord + i] +=
          Math.sin((2 * Math.PI * frequency * i) / sampleRate) / notes.length;
      }
    }
  });
  return samples;
}

describe("key detection", () => {
  it("maps keys to Camelot notation", () => {
    expect(describeKey(0, "major")).toMatchObject({ camelot: "8B", name: "C" });
    expect(describeKey(9, "minor")).toMatchObject({ camelot: "8A", name: "Am" });
    expect(describeKey(6, "major")).toMatchObject({ camelot: "2B", name: "F#" });
  });

  it("detects C major from a I–IV–V–I progression", () => {
    // C E G, F A C, G B D, C E G
    const samples = render([
      [60, 64, 67],
      [65, 69, 72],
      [67, 71, 74],
      [60, 64, 67],
    ]);
    expect(keyFromChroma(chromagram(samples, sampleRate))).toMatchObject({ name: "C" });
  });

  it("detects A minor from an i–iv–V–i progression", () => {
    // A C E, D F A, E G# B, A C E
    const samples = render([
      [57, 60, 64],
      [62, 65, 69],
      [64, 68, 71],
      [57, 60, 64],
    ]);
    expect(keyFromChroma(chromagram(samples, sampleRate))).toMatchObject({ name: "Am" });
  });

  it("returns nothing for silence", () => {
    expect(keyFromChroma(chromagram(new Float32Array(sampleRate * 2), sampleRate))).toBeNull();
  });
});
