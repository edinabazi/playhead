import type { SoundCloudComment } from "../../../../shared/library";

export type CommentSlot = {
  /** Horizontal position as a fraction of the track, 0–1. */
  position: number;
  /** The comment shown for the slot: the newest one in it. */
  comment: SoundCloudComment;
  count: number;
};

/**
 * Groups comments into fixed-width slots so the number of avatars drawn depends on the
 * waveform width, not on how many comments a track has.
 */
export function bucketComments(
  comments: SoundCloudComment[],
  duration: number,
  slotCount: number,
): CommentSlot[] {
  if (!duration || slotCount <= 0) return [];
  const slots = new Map<number, CommentSlot>();
  for (const comment of comments) {
    if (comment.time > duration) continue;
    const index = Math.min(slotCount - 1, Math.floor((comment.time / duration) * slotCount));
    const slot = slots.get(index);
    if (!slot) {
      slots.set(index, { position: (index + 0.5) / slotCount, comment, count: 1 });
      continue;
    }
    slot.count += 1;
    if ((comment.createdAt || "") > (slot.comment.createdAt || "")) slot.comment = comment;
  }
  return [...slots.values()].sort((a, b) => a.position - b.position);
}

/**
 * Index of the comment to pop up at `time`: the last one at or before the playhead, while it
 * is still within `holdSeconds`. Comments must be sorted by time. Returns -1 when none.
 */
export function findActiveComment(
  comments: SoundCloudComment[],
  time: number,
  holdSeconds = 3,
): number {
  let low = 0;
  let high = comments.length - 1;
  let found = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (comments[middle].time <= time) {
      found = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return found !== -1 && time - comments[found].time < holdSeconds ? found : -1;
}
