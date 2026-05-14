import { describe, expect, it, vi } from "vitest";
import type { LibraryTrack, PlaybackQueueItem } from "../../../../../shared/library";
import {
  addTracksToQueue,
  buildQueueFromTracks,
  reorderQueueItems,
  smartShuffleQueue,
} from "../queue-model";

vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "test-id") });

const tracks: LibraryTrack[] = [
  track("track-1", "A", "Artist 1", "Album 1"),
  track("track-2", "B", "Artist 1", "Album 1"),
  track("track-3", "C", "Artist 2", "Album 2"),
  track("track-4", "D", "Artist 3", "Album 3"),
];
const tracksById = Object.fromEntries(tracks.map((item) => [item.id, item]));

describe("queue model", () => {
  it("builds a queue from the active track through the rest of the source", () => {
    const queue = buildQueueFromTracks(tracks, "track-2", { type: "playlist" }, tracksById, false);

    expect(queue.items.map((item) => item.trackId)).toEqual(["track-2", "track-3", "track-4"]);
    expect(queue.activeItemId).toBe(queue.items[0].id);
  });

  it("keeps duplicate tracks reorderable by queue item id", () => {
    const queue = {
      items: [
        { id: "queue-1", trackId: "track-1" },
        { id: "queue-2", trackId: "track-1" },
        { id: "queue-3", trackId: "track-2" },
      ],
      shuffledItems: [],
      activeItemId: "queue-1",
      source: null,
      panelOpen: false,
    };

    const next = reorderQueueItems(queue, ["queue-2"], "queue-3", "after", false);

    expect(next.items.map((item) => item.id)).toEqual(["queue-1", "queue-3", "queue-2"]);
  });

  it("inserts dropped tracks at the requested queue position", () => {
    const queue = {
      items: [
        { id: "queue-1", trackId: "track-1" },
        { id: "queue-2", trackId: "track-2" },
      ],
      shuffledItems: [],
      activeItemId: "queue-1",
      source: null,
      panelOpen: false,
    };

    const next = addTracksToQueue(queue, ["track-3"], "queue-2", "before", false);

    expect(next.items.map((item) => item.trackId)).toEqual(["track-1", "track-3", "track-2"]);
  });

  it("pins the active item first when smart shuffling", () => {
    const items: PlaybackQueueItem[] = tracks.map((item, index) => ({
      id: `queue-${index + 1}`,
      trackId: item.id,
    }));

    const shuffled = smartShuffleQueue(items, "queue-2", tracksById);

    expect(shuffled[0].id).toBe("queue-2");
    expect(new Set(shuffled.map((item) => item.id))).toEqual(new Set(items.map((item) => item.id)));
  });
});

function track(id: string, title: string, artist: string, album: string): LibraryTrack {
  return {
    id,
    path: `/music/${id}.mp3`,
    fileName: `${id}.mp3`,
    title,
    artist,
    album,
    duration: 1,
    folderId: "folder-1",
  };
}
