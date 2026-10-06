import { describe, expect, it } from "vitest";
import type { SoundCloudComment } from "../../../../../shared/library";
import { bucketComments, findActiveComment } from "../waveform-comments";

const comment = (id: string, time: number, createdAt = "2026-01-01"): SoundCloudComment => ({
  id,
  body: id,
  time,
  createdAt,
  username: "user",
});

describe("bucketComments", () => {
  it("caps avatars at the slot count and keeps the newest comment per slot", () => {
    const comments = Array.from({ length: 5000 }, (_, index) =>
      comment(`c${index}`, (index / 5000) * 100),
    );
    expect(bucketComments(comments, 100, 40)).toHaveLength(40);

    const slots = bucketComments(
      [comment("old", 1, "2025-01-01"), comment("new", 2, "2026-05-01"), comment("late", 90)],
      100,
      10,
    );
    expect(slots.map((slot) => [slot.comment.id, slot.count])).toEqual([
      ["new", 2],
      ["late", 1],
    ]);
    expect(slots[0].position).toBeCloseTo(0.05);
  });

  it("ignores comments past the end and empty inputs", () => {
    expect(bucketComments([comment("a", 200)], 100, 10)).toEqual([]);
    expect(bucketComments([comment("a", 1)], 0, 10)).toEqual([]);
  });
});

describe("findActiveComment", () => {
  const comments = [comment("a", 10), comment("b", 20), comment("c", 21)];

  it("finds the latest comment at the playhead while it is held", () => {
    expect(findActiveComment(comments, 5)).toBe(-1);
    expect(findActiveComment(comments, 10)).toBe(0);
    expect(findActiveComment(comments, 12.9)).toBe(0);
    expect(findActiveComment(comments, 13)).toBe(-1);
    expect(findActiveComment(comments, 21.5)).toBe(2);
  });
});
