import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const scannerMocks = vi.hoisted(() => ({ parseFile: vi.fn() }));

vi.mock("music-metadata", () => ({ parseFile: scannerMocks.parseFile }));
vi.mock("../../artwork", () => ({
  getArtwork: vi.fn(),
  getAvailableArtwork: vi.fn(),
  getContentAddressedArtwork: vi.fn(),
  getStoredArtwork: vi.fn(),
}));

import { scanFolderPath } from "../scanner";

const tempDirectories: string[] = [];

async function createTempDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "playhead-scanner-"));
  tempDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  scannerMocks.parseFile.mockReset();
  await Promise.all(
    tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

function mockMetadata() {
  scannerMocks.parseFile.mockResolvedValue({
    common: { title: "Track", artist: "Artist", track: {}, disk: {} },
    format: { duration: 120, container: "MP3", sampleRate: 44_100, bitrate: 320_000 },
  });
}

describe("library scanner", () => {
  it("refreshes legacy cached tracks once and keeps text Disc and Genre tags", async () => {
    const directory = await createTempDirectory();
    await writeFile(join(directory, "track.mp3"), Buffer.from("audio"));
    mockMetadata();
    const first = await scanFolderPath(directory);
    const legacy = { ...first.tracks[0], metadataVersion: undefined };
    scannerMocks.parseFile.mockResolvedValue({
      common: {
        title: "Track",
        artist: "Artist",
        track: { no: 2 },
        disk: { no: null },
        genre: ["House", "Disco"],
        composer: ["Writer"],
      },
      native: { "ID3v2.4": [{ id: "TPOS", value: "Warm-up" }] },
      format: { duration: 120 },
    });
    const refreshed = await scanFolderPath(directory, undefined, { [legacy.id]: legacy });
    expect(refreshed.tracks[0]).toMatchObject({
      genre: "House, Disco",
      disc: "Warm-up",
      composer: "Writer",
      trackNumber: 2,
    });
    await scanFolderPath(directory, undefined, { [legacy.id]: refreshed.tracks[0] });
    expect(scannerMocks.parseFile).toHaveBeenCalledTimes(2);
  });

  it("reuses metadata for unchanged audio files", async () => {
    const directory = await createTempDirectory();
    const filePath = join(directory, "track.mp3");
    await writeFile(filePath, Buffer.from("audio"));
    mockMetadata();

    const firstScan = await scanFolderPath(directory);
    const existingTracks = Object.fromEntries(firstScan.tracks.map((track) => [track.id, track]));
    const secondScan = await scanFolderPath(directory, undefined, existingTracks);

    expect(scannerMocks.parseFile).toHaveBeenCalledTimes(1);
    expect(secondScan.tracks).toEqual(firstScan.tracks);
  });

  it("refreshes metadata after an audio file changes", async () => {
    const directory = await createTempDirectory();
    const filePath = join(directory, "track.mp3");
    await writeFile(filePath, Buffer.from("audio"));
    mockMetadata();

    const firstScan = await scanFolderPath(directory);
    const existingTracks = Object.fromEntries(firstScan.tracks.map((track) => [track.id, track]));
    await writeFile(filePath, Buffer.from("changed-audio"));
    await scanFolderPath(directory, undefined, existingTracks);

    expect(scannerMocks.parseFile).toHaveBeenCalledTimes(2);
  });
});
