import { describe, expect, it } from "vitest";
import type { LibraryTrack } from "../library";
import {
  buildSmartPlaylistContext,
  matchesSmartPlaylist,
  type SmartPlaylistRule,
} from "../smart-playlist";

const now = Date.UTC(2026, 9, 7);
const track = (id: string, fields: Partial<LibraryTrack> = {}): LibraryTrack => ({
  id,
  path: `/music/${id}.mp3`,
  fileName: `${id}.mp3`,
  title: id,
  artist: "Artist",
  duration: 240,
  folderId: "folder",
  ...fields,
});
const rule = (fields: Omit<SmartPlaylistRule, "id">): SmartPlaylistRule => ({ id: "r", ...fields });
const context = buildSmartPlaylistContext(["loved"], [{ id: "tag-1", trackIds: ["tagged"] }], now);

describe("smart playlists", () => {
  it("matches text, number and between rules", () => {
    const house = track("a", { genre: "Deep House", bpm: 124 });
    const playlist = {
      match: "all" as const,
      rules: [
        rule({ field: "genre", operator: "contains", value: "house" }),
        rule({ field: "bpm", operator: "between", value: "120", value2: "128" }),
      ],
    };
    expect(matchesSmartPlaylist(house, playlist, context)).toBe(true);
    expect(matchesSmartPlaylist({ ...house, bpm: 140 }, playlist, context)).toBe(false);
    expect(matchesSmartPlaylist({ ...house, bpm: undefined }, playlist, context)).toBe(false);
  });

  it("supports any-of matching, loved, tags and recent files", () => {
    const playlist = {
      match: "any" as const,
      rules: [
        rule({ field: "loved", operator: "is", value: "" }),
        rule({ field: "tag", operator: "is", value: "tag-1" }),
        rule({ field: "modified", operator: "inLastDays", value: "30" }),
      ],
    };
    expect(matchesSmartPlaylist(track("loved"), playlist, context)).toBe(true);
    expect(matchesSmartPlaylist(track("tagged"), playlist, context)).toBe(true);
    expect(
      matchesSmartPlaylist(track("new", { fileModifiedAt: now - 86_400_000 }), playlist, context),
    ).toBe(true);
    expect(
      matchesSmartPlaylist(
        track("old", { fileModifiedAt: now - 90 * 86_400_000 }),
        playlist,
        context,
      ),
    ).toBe(false);
  });

  it("never matches everything when there are no rules", () => {
    expect(matchesSmartPlaylist(track("a"), { match: "all", rules: [] }, context)).toBe(false);
  });
});
