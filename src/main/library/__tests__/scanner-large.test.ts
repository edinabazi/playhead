// @vitest-environment node
import { expect, it, vi, beforeEach } from "vitest";
const mocks = vi.hoisted(() => ({ opendir: vi.fn(), stat: vi.fn(), parseFile: vi.fn() }));
vi.mock("node:fs/promises", () => ({ opendir: mocks.opendir, stat: mocks.stat }));
vi.mock("music-metadata", () => ({ parseFile: mocks.parseFile }));
import { scanFolderPath, type ScanArtwork } from "../scanner";
import type { ScanProgress } from "../../../shared/library-scan";

const artwork: ScanArtwork = {
  getArtwork: async () => undefined,
  getStoredArtwork: async () => undefined,
  getAvailableArtwork: async () => undefined,
  getContentAddressedArtwork: async () => undefined,
};
const entry = (name: string, directory = false) => ({
  name,
  isDirectory: () => directory,
  isFile: () => !directory,
});
beforeEach(() => {
  vi.resetAllMocks();
  mocks.stat.mockImplementation(async (path: string) => ({
    isDirectory: () => path === "/music",
    size: 100,
    mtimeMs: 100,
  }));
  mocks.parseFile.mockResolvedValue({ common: { track: {}, disk: {} }, format: { duration: 120 } });
});

it("imports 110,000 tracks across 5,500 directories with bounded metadata concurrency", async () => {
  mocks.opendir.mockImplementation(async (path: string) =>
    (async function* () {
      if (path === "/music") {
        for (let i = 0; i < 5500; i++) yield entry(`album-${i}`, true);
      } else {
        yield entry("cover.jpg");
        for (let i = 0; i < 20; i++) yield entry(`track-${i}.flac`);
      }
    })(),
  );
  let active = 0;
  let peak = 0;
  mocks.parseFile.mockImplementation(async () => {
    active++;
    peak = Math.max(peak, active);
    await Promise.resolve();
    active--;
    return { common: { track: {}, disk: {} }, format: { duration: 120 } };
  });
  const progress: ScanProgress[] = [];
  const result = await scanFolderPath(
    "/music",
    undefined,
    {},
    { artwork, onProgress: (p) => progress.push(p) },
  );
  expect(result.tracks).toHaveLength(110000);
  expect(new Set(result.folder.trackIds).size).toBe(110000);
  expect(peak).toBeLessThanOrEqual(4);
  expect(progress[0].phase).toBe("discovering");
  expect(progress.at(-1)).toEqual({
    phase: "reading",
    processed: 110000,
    discovered: 110000,
    directories: 5501,
  });
}, 20000);

it("rejects unreadable directories instead of returning an incomplete successful scan", async () => {
  mocks.opendir.mockRejectedValue(Object.assign(new Error("offline"), { code: "EIO" }));
  await expect(scanFolderPath("/music", undefined, {}, { artwork })).rejects.toMatchObject({
    code: "EIO",
  });
});

it("cancels between discovery and metadata without returning partial results", async () => {
  mocks.opendir.mockResolvedValue(
    (async function* () {
      yield entry("song.mp3");
    })(),
  );
  const controller = new AbortController();
  await expect(
    scanFolderPath(
      "/music",
      undefined,
      {},
      {
        artwork,
        signal: controller.signal,
        onProgress: (p) => {
          if (p.phase === "reading") controller.abort();
        },
      },
    ),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(mocks.parseFile).not.toHaveBeenCalled();
});

it("retains project-folder protection and never traverses directory symlinks", async () => {
  mocks.opendir.mockResolvedValueOnce(
    (async function* () {
      yield { name: "loop", isDirectory: () => false, isFile: () => false };
      yield entry("cover.jpg");
    })(),
  );
  expect((await scanFolderPath("/music", undefined, {}, { artwork })).tracks).toEqual([]);
  expect(mocks.opendir).toHaveBeenCalledOnce();
  mocks.opendir.mockResolvedValueOnce(
    (async function* () {
      yield entry("package.json");
    })(),
  );
  await expect(scanFolderPath("/music", undefined, {}, { artwork })).rejects.toThrow(
    "project folder",
  );
});
