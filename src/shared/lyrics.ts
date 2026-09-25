export type LyricLine = { time: number | null; text: string };
export type Lyrics = { synced: boolean; lines: LyricLine[] };
export type TrackLyrics = {
  lyrics: Lyrics | null;
  source: "file" | "embedded" | null;
  fileName?: string;
  custom: boolean;
  error?: string;
};

// Positive LRC offsets advance the lyrics relative to the audio.
export function parseLyrics(text: string): Lyrics | null {
  const input = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .trim();
  if (!input) return null;
  if (input.length > 1024 * 1024) throw new Error("Choose a lyrics file smaller than 1 MB.");
  const rows = input.split("\n");
  if (rows.length > 5000) throw new Error("This lyrics file has too many lines.");
  const offsetMatches = [...input.matchAll(/^\s*\[offset:([+-]?\d+)\]\s*$/gim)];
  const offset = Number(offsetMatches.at(-1)?.[1] ?? 0) / 1000;
  const timed: LyricLine[] = [];
  const plain: LyricLine[] = [];
  for (const row of rows) {
    const stamps = [...row.matchAll(/\[(\d{1,4}):([0-5]\d)(?:[.:](\d{1,3}))?\]/g)];
    if (stamps.length) {
      const lyric = row
        .replace(/\[\d{1,4}:[0-5]\d(?:[.:]\d{1,3})?\]/g, "")
        .replace(/<\d{1,4}:[0-5]\d(?:[.:]\d{1,3})?>/g, "")
        .trim();
      for (const stamp of stamps) {
        const time =
          Number(stamp[1]) * 60 + Number(stamp[2]) + Number(`0.${stamp[3] || "0"}`) - offset;
        timed.push({ time: Math.max(0, time), text: lyric });
        if (timed.length > 5000) throw new Error("This lyrics file has too many lines.");
      }
    } else if (!/^\s*\[(?:[a-z]+:|\d+:)/i.test(row)) {
      plain.push({ time: null, text: row.trim() });
    }
  }
  if (timed.some((line) => line.text)) return normalizeTimedLyrics(timed);
  return plain.some((line) => line.text) ? { synced: false, lines: plain } : null;
}

export function normalizeTimedLyrics(lines: LyricLine[]): Lyrics {
  const sorted = lines
    .filter((line) => line.time !== null && Number.isFinite(line.time))
    .map((line) => ({ ...line, time: Math.max(0, line.time!) }))
    .sort((a, b) => a.time - b.time);
  const grouped: LyricLine[] = [];
  for (const line of sorted) {
    const previous = grouped.at(-1);
    if (previous && previous.time === line.time) {
      if (line.text && !previous.text.split("\n").includes(line.text))
        previous.text = [previous.text, line.text].filter(Boolean).join("\n");
    } else grouped.push({ ...line });
  }
  return { synced: true, lines: grouped };
}

export function activeLyricIndex(lines: LyricLine[], time: number): number {
  let low = 0;
  let high = lines.length - 1;
  while (low <= high) {
    const middle = (low + high) >>> 1;
    if (lines[middle].time !== null && lines[middle].time! <= time) low = middle + 1;
    else high = middle - 1;
  }
  return high;
}
