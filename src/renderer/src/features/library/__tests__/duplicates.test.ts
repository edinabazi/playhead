import { describe, expect, it } from "vitest";
import type { LibraryTrack } from "../../../../../shared/library";
import { findDuplicateGroups } from "../duplicates";

const track = (id: string, fields: Partial<LibraryTrack>): LibraryTrack => ({
  id,
  path: `/music/${id}.mp3`,
  fileName: `${id}.mp3`,
  title: "Song",
  artist: "Artist",
  duration: 200,
  folderId: "folder",
  ...fields,
});

describe("findDuplicateGroups", () => {
  it("groups the same recording across folders, ignoring case and punctuation", () => {
    const groups = findDuplicateGroups([
      track("a", { title: "Café del Mar!", artist: "Energy 52" }),
      track("b", { title: "cafe del mar", artist: "energy 52", duration: 201.5 }),
      track("c", { title: "Something Else" }),
    ]);
    expect(groups.map((group) => group.map((item) => item.id))).toEqual([["a", "b"]]);
  });

  it("keeps edits of different lengths apart", () => {
    const groups = findDuplicateGroups([
      track("radio", { duration: 210 }),
      track("radio-copy", { duration: 211 }),
      track("extended", { duration: 420 }),
    ]);
    expect(groups.map((group) => group.map((item) => item.id))).toEqual([["radio", "radio-copy"]]);
  });

  it("ignores SoundCloud tracks", () => {
    expect(findDuplicateGroups([track("a", {}), track("b", { source: "soundcloud" })])).toEqual([]);
  });
});
