import { describe, expect, it } from "vitest";
import { applySoundCloudPlaylistEdit } from "../soundcloud-playlist";

describe("applySoundCloudPlaylistEdit", () => {
  const current = [1, 2, 3, 4, 5];

  it("appends new tracks without duplicating existing ones", () => {
    expect(applySoundCloudPlaylistEdit(current, { type: "add", trackIds: [3, 6, 6] })).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
  });

  it("removes tracks", () => {
    expect(applySoundCloudPlaylistEdit(current, { type: "remove", trackIds: [2, 4] })).toEqual([
      1, 3, 5,
    ]);
  });

  it("moves tracks before or after a target, keeping their order", () => {
    expect(
      applySoundCloudPlaylistEdit(current, {
        type: "move",
        trackIds: [5, 1],
        targetTrackId: 3,
        edge: "before",
      }),
    ).toEqual([2, 1, 5, 3, 4]);
    expect(
      applySoundCloudPlaylistEdit(current, {
        type: "move",
        trackIds: [1],
        targetTrackId: 4,
        edge: "after",
      }),
    ).toEqual([2, 3, 4, 1, 5]);
    expect(
      applySoundCloudPlaylistEdit(current, {
        type: "move",
        trackIds: [3],
        targetTrackId: 3,
        edge: "after",
      }),
    ).toBe(current);
  });
});
