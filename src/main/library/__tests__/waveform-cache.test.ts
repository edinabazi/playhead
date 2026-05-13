import { mkdtemp, readFile, readdir, stat, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  decodeWaveformCache,
  encodeWaveformCache,
  getWaveformCachePeakCount,
  readWaveformCache,
  waveformCacheChannels,
  waveformCacheMaxPeaks,
  waveformCachePeakRate,
  writeWaveformCache,
} from "../waveform-cache";

const tempDirectories: string[] = [];

async function createTempDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "playhead-waveform-cache-"));
  tempDirectories.push(directory);
  return directory;
}

async function createAudioFile(directory: string, name = "track.mp3"): Promise<string> {
  const filePath = join(directory, name);
  await writeFile(filePath, Buffer.from("audio-source"));
  return filePath;
}

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map(async (directory) => {
      await import("node:fs/promises").then(({ rm }) =>
        rm(directory, { recursive: true, force: true }),
      );
    }),
  );
});

describe("waveform cache encoding", () => {
  it("round-trips compact signed-byte peaks", () => {
    const encoded = encodeWaveformCache(
      {
        version: 1,
        size: 10,
        mtimeMs: 20,
        duration: 1,
        channels: waveformCacheChannels,
        peakRate: waveformCachePeakRate,
        maxPeaks: waveformCacheMaxPeaks,
        peakCount: getWaveformCachePeakCount(1),
      },
      [[-1, -0.5, 0, 0.5, 1]],
    );

    const decoded = decodeWaveformCache(encoded);

    expect(decoded?.header.duration).toBe(1);
    expect(decoded?.entry.peaks[0].slice(0, 5)).toEqual([
      -1,
      -63 / 127,
      0,
      64 / 127,
      1,
    ]);
  });

  it("clamps invalid and out-of-range peaks", () => {
    const decoded = decodeWaveformCache(
      encodeWaveformCache(
        {
          version: 1,
          size: 10,
          mtimeMs: 20,
          duration: 0.2,
          channels: waveformCacheChannels,
          peakRate: waveformCachePeakRate,
          maxPeaks: waveformCacheMaxPeaks,
          peakCount: getWaveformCachePeakCount(0.2),
        },
        [[-2, Number.NaN, Number.POSITIVE_INFINITY, 2]],
      ),
    );

    expect(decoded?.entry.peaks[0]).toEqual([-1, 0, 0, 1]);
  });

  it("rejects corrupt payloads and version mismatches", () => {
    expect(decodeWaveformCache(Buffer.from("not-waveform"))).toBeNull();

    const encoded = encodeWaveformCache(
      {
        version: 1,
        size: 10,
        mtimeMs: 20,
        duration: 1,
        channels: waveformCacheChannels,
        peakRate: waveformCachePeakRate,
        maxPeaks: waveformCacheMaxPeaks,
        peakCount: getWaveformCachePeakCount(1),
      },
      [[0]],
    );
    const headerEnd = encoded.indexOf("\n", Buffer.from("PHWF1\n").length);
    const header = JSON.parse(
      encoded.subarray(Buffer.from("PHWF1\n").length, headerEnd).toString("utf8"),
    );
    header.version = 999;

    expect(
      decodeWaveformCache(
        Buffer.concat([
          Buffer.from("PHWF1\n", "ascii"),
          Buffer.from(`${JSON.stringify(header)}\n`, "utf8"),
          encoded.subarray(headerEnd + 1),
        ]),
      ),
    ).toBeNull();
    expect(decodeWaveformCache(encoded.subarray(0, encoded.length - 1))).toBeNull();
  });
});

describe("waveform cache storage", () => {
  it("returns a hit while source file metadata matches", async () => {
    const directory = await createTempDirectory();
    const sourcePath = await createAudioFile(directory);
    const cacheDirectory = join(directory, "waveforms");
    const request = { trackId: "track-1", path: sourcePath, duration: 1 };

    await writeWaveformCache({ ...request, peaks: [[-1, 0, 1]] }, { directory: cacheDirectory });

    const entry = await readWaveformCache(request, { directory: cacheDirectory });

    expect(entry?.duration).toBe(1);
    expect(entry?.peaks[0].slice(0, 3)).toEqual([-1, 0, 1]);
  });

  it("misses when the source file changes", async () => {
    const directory = await createTempDirectory();
    const sourcePath = await createAudioFile(directory);
    const cacheDirectory = join(directory, "waveforms");
    const request = { trackId: "track-1", path: sourcePath, duration: 1 };

    await writeWaveformCache({ ...request, peaks: [[0]] }, { directory: cacheDirectory });
    await writeFile(sourcePath, Buffer.from("changed-audio-source"));

    await expect(readWaveformCache(request, { directory: cacheDirectory })).resolves.toBeNull();
  });

  it("prunes oldest cache files first to stay within the byte budget", async () => {
    const directory = await createTempDirectory();
    const cacheDirectory = join(directory, "waveforms");
    const tracks = await Promise.all(
      ["a", "b", "c"].map(async (trackId) => {
        const sourcePath = await createAudioFile(directory, `${trackId}.mp3`);
        const sourceInfo = await stat(sourcePath);
        await writeWaveformCache(
          {
            trackId,
            path: sourcePath,
            duration: 10,
            peaks: [Array.from({ length: getWaveformCachePeakCount(10) }, () => 0)],
          },
          { directory: cacheDirectory, maxBytes: 10_000 },
        );
        const cachePath = join(cacheDirectory, `${trackId}.wf`);
        await utimes(cachePath, sourceInfo.atime, new Date(1_000 + trackId.charCodeAt(0)));
        return { trackId, cachePath };
      }),
    );
    const maxBytes =
      (await stat(tracks[1].cachePath)).size + (await stat(tracks[2].cachePath)).size + 1;

    const finalSourcePath = await createAudioFile(directory, "d.mp3");
    await writeWaveformCache(
      {
        trackId: "d",
        path: finalSourcePath,
        duration: 10,
        peaks: [Array.from({ length: getWaveformCachePeakCount(10) }, () => 0.5)],
      },
      { directory: cacheDirectory, maxBytes },
    );

    const files = await readdir(cacheDirectory);
    const totalSize = (
      await Promise.all(files.map(async (file) => (await stat(join(cacheDirectory, file))).size))
    ).reduce((total, size) => total + size, 0);

    expect(files.sort()).toEqual(["c.wf", "d.wf"]);
    expect(totalSize).toBeLessThanOrEqual(maxBytes);
    await expect(readFile(tracks[0].cachePath)).rejects.toThrow();
  });
});
