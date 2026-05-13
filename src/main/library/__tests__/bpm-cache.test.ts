import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { readBpmCache, writeBpmCache } from "../bpm-cache";

const tempDirectories: string[] = [];

async function createTempDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "playhead-bpm-cache-"));
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

describe("bpm cache storage", () => {
  it("returns a hit while source file metadata matches", async () => {
    const directory = await createTempDirectory();
    const sourcePath = await createAudioFile(directory);
    const cacheDirectory = join(directory, "bpm");
    const request = { trackId: "track-1", path: sourcePath };

    await writeBpmCache(
      { ...request, bpm: 128, tempo: 127.7, analyzedAt: "2026-05-13T00:00:00.000Z" },
      { directory: cacheDirectory },
    );

    await expect(readBpmCache(request, { directory: cacheDirectory })).resolves.toEqual({
      bpm: 128,
      tempo: 127.7,
      analyzedAt: "2026-05-13T00:00:00.000Z",
    });
  });

  it("misses when the source file changes", async () => {
    const directory = await createTempDirectory();
    const sourcePath = await createAudioFile(directory);
    const cacheDirectory = join(directory, "bpm");
    const request = { trackId: "track-1", path: sourcePath };

    await writeBpmCache(
      { ...request, bpm: 128, tempo: 127.7, analyzedAt: "2026-05-13T00:00:00.000Z" },
      { directory: cacheDirectory },
    );
    await writeFile(sourcePath, Buffer.from("changed-audio-source"));

    await expect(readBpmCache(request, { directory: cacheDirectory })).resolves.toBeNull();
  });

  it("ignores invalid bpm writes", async () => {
    const directory = await createTempDirectory();
    const sourcePath = await createAudioFile(directory);
    const cacheDirectory = join(directory, "bpm");
    const request = { trackId: "track-1", path: sourcePath };

    await writeBpmCache(
      { ...request, bpm: Number.NaN, tempo: 127.7, analyzedAt: "2026-05-13T00:00:00.000Z" },
      { directory: cacheDirectory },
    );

    await expect(readBpmCache(request, { directory: cacheDirectory })).resolves.toBeNull();
  });
});
