// @vitest-environment node
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { IAudioMetadata } from "music-metadata";
const { parseFile } = vi.hoisted(() => ({ parseFile: vi.fn() }));
vi.mock("music-metadata", () => ({ parseFile }));
import { embeddedLyrics, loadTrackLyrics, readLyricsFile } from "../lyrics";
let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "playhead-lyrics-"));
  parseFile.mockReset();
});
afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

it("prefers a matching sidecar and a chosen file over embedded lyrics, including uppercase extensions", async () => {
  await writeFile(join(directory, "Song.LRC"), "[00:02]Sidecar");
  await writeFile(join(directory, "custom.lrc"), "Custom text");
  expect((await loadTrackLyrics(join(directory, "Song.flac"))).lyrics?.lines[0].text).toBe(
    "Sidecar",
  );
  const chosen = await loadTrackLyrics(join(directory, "Song.flac"), join(directory, "custom.lrc"));
  expect(chosen.custom).toBe(true);
  expect(chosen.lyrics?.lines[0].text).toBe("Custom text");
  expect(parseFile).not.toHaveBeenCalled();
});
it("loads embedded text on demand and preserves offsets in raw embedded LRC", async () => {
  parseFile.mockResolvedValue({
    native: { vorbis: [{ id: "LYRICS", value: "[00:01][00:02]Line\n[offset:+500]" }] },
    common: {},
  });
  expect((await loadTrackLyrics(join(directory, "Song.flac"))).lyrics?.lines).toEqual([
    { time: 0.5, text: "Line" },
    { time: 1.5, text: "Line" },
  ]);
  expect(parseFile).toHaveBeenCalledWith(join(directory, "Song.flac"), {
    skipCovers: true,
    duration: false,
  });
});
it("prefers synchronized embedded lyrics and doesn't mistake MPEG frame numbers for milliseconds", () => {
  const result = embeddedLyrics({
    native: { ID3: [{ id: "USLT", value: { text: "Plain lyrics" } }] },
    common: {
      lyrics: [
        { text: "Plain lyrics" },
        { timeStampFormat: 2, syncText: [{ timestamp: 1500, text: "Synced lyrics" }] },
      ],
    },
  } as unknown as IAudioMetadata);
  expect(result?.lines).toEqual([{ time: 1.5, text: "Synced lyrics" }]);
  expect(
    embeddedLyrics({
      native: {},
      common: {
        lyrics: [{ timeStampFormat: 1, syncText: [{ timestamp: 2000, text: "Frame lyrics" }] }],
      },
    } as unknown as IAudioMetadata)?.synced,
  ).toBe(false);
});
it("reads UTF-16, rejects binary or empty files and reports moved selections", async () => {
  const path = join(directory, "lyrics.lrc");
  await writeFile(path, Buffer.from("\uFEFF[00:01]日本語", "utf16le"));
  expect((await readLyricsFile(path)).lines[0].text).toBe("日本語");
  await writeFile(path, Buffer.from([0xff, 0x80, 0xff]));
  await expect(readLyricsFile(path)).rejects.toThrow("UTF-8");
  await writeFile(path, "[ti:Title]");
  await expect(readLyricsFile(path)).rejects.toThrow("readable lyrics");
  const result = await loadTrackLyrics(join(directory, "Song.mp3"), join(directory, "missing.lrc"));
  expect(result.custom).toBe(true);
  expect(result.error).toContain("moved");
});
