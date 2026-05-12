import { describe, expect, it, vi } from "vitest";
import type { LastfmQueueJob } from "../lastfm";

vi.stubEnv("LASTFM_API_KEY", "test-key");
vi.stubEnv("LASTFM_SHARED_SECRET", "test-secret");

const { collapseLastfmLoveQueue, createLastfmAuthUrl, signLastfmParams } = await import(
  "../lastfm"
);

describe("Last.fm helpers", () => {
  it("signs sorted API params with the shared secret", () => {
    expect(
      signLastfmParams({
        method: "track.love",
        track: "Song",
        artist: "Artist",
        api_key: "test-key",
        sk: "session",
      }),
    ).toBe("172d25e2ace239c3c8fb421480857718");
  });

  it("creates a desktop auth URL", () => {
    expect(createLastfmAuthUrl("token-1")).toBe(
      "https://www.last.fm/api/auth/?api_key=test-key&token=token-1",
    );
  });

  it("collapses queued love state to the latest intent for a track", () => {
    const queue: LastfmQueueJob[] = [
      {
        id: "scrobble-1",
        type: "scrobble",
        track: { artist: "Artist", title: "Song", timestamp: 1 },
      },
      { id: "love-1", type: "love", track: { artist: "Artist", title: "Song" } },
      { id: "love-2", type: "love", track: { artist: "Other", title: "Song" } },
    ];

    expect(
      collapseLastfmLoveQueue(queue, {
        type: "unlove",
        track: { artist: "Artist", title: "Song" },
      }).map((job) => job.id),
    ).toEqual(["scrobble-1", "love-2"]);
  });
});
