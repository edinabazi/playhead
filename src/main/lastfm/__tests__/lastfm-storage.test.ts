import { mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ directory: "" }));

vi.mock("../../electron", () => ({
  electron: {
    app: { getPath: () => mocks.directory },
    ipcMain: { handle: vi.fn() },
    safeStorage: { isEncryptionAvailable: () => false },
    shell: { openExternal: vi.fn() },
  },
}));

vi.stubEnv("LASTFM_API_KEY", "test-key");
vi.stubEnv("LASTFM_SHARED_SECRET", "test-secret");

const statePath = () => join(mocks.directory, "lastfm.json");
const queuePath = () => join(mocks.directory, "lastfm-queue.json");

async function loadModule() {
  vi.resetModules();
  return import("../lastfm");
}

beforeEach(async () => {
  mocks.directory = await mkdtemp(join(tmpdir(), "playhead-lastfm-"));
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await rm(mocks.directory, { recursive: true, force: true });
});

describe("Last.fm storage", () => {
  it("keeps the session when overlapping calls write the state file", async () => {
    await writeFile(
      statePath(),
      JSON.stringify({ session: { username: "listener", sessionKey: "sk", encrypted: false } }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => new Response(JSON.stringify({ error: 11, message: "Down" }), { status: 503 }),
      ),
    );
    const lastfm = await loadModule();
    const track = { artist: "Artist", title: "Song", timestamp: 1_700_000_000 };

    const results = await Promise.all([
      lastfm.updateLastfmNowPlaying(track),
      lastfm.scrobbleLastfmTrack(track),
      lastfm.loveLastfmTrack(track),
      lastfm.updateLastfmNowPlaying(track),
      lastfm.getLastfmState(),
    ]);

    for (const state of results) expect(state.connected).toBe(true);
    const saved = JSON.parse(await readFile(statePath(), "utf8"));
    expect(saved.session).toEqual({ username: "listener", sessionKey: "sk", encrypted: false });
    expect(saved.lastError).toBe("Down");
    expect((await stat(statePath())).mode & 0o777).toBe(0o600);

    const queue = JSON.parse(await readFile(queuePath(), "utf8"));
    expect(queue.map((job: { type: string }) => job.type).sort()).toEqual(["love", "scrobble"]);
    expect((await readdir(mocks.directory)).filter((name) => name.endsWith(".tmp"))).toEqual([]);
  });

  it("disconnect clears the session and queue even after pending writes", async () => {
    await writeFile(
      statePath(),
      JSON.stringify({ session: { username: "listener", sessionKey: "sk", encrypted: false } }),
    );
    await writeFile(
      queuePath(),
      JSON.stringify([{ id: "1", type: "love", track: { artist: "A", title: "B" } }]),
    );
    const lastfm = await loadModule();
    expect((await lastfm.getLastfmState()).queueSize).toBe(1);

    const state = await lastfm.disconnectLastfm();

    expect(state.connected).toBe(false);
    expect(state.queueSize).toBe(0);
    expect(await readdir(mocks.directory)).toEqual([]);
  });
});
