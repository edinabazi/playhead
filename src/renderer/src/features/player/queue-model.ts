import type {
  LibraryTrack,
  PlaybackQueue,
  PlaybackQueueItem,
  PlaybackQueueSource,
} from "../../../../shared/library";
import { moveItemsBeforeOrAfter } from "@/lib/list";

export type QueueDropEdge = "before" | "after";

function createQueueItem(trackId: string): PlaybackQueueItem {
  return { id: `queue-${crypto.randomUUID()}`, trackId };
}

function shuffled<T>(items: T[]): T[] {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function trackKey(track: LibraryTrack | undefined, field: "artist" | "album"): string {
  return (track?.[field] || "").trim().toLowerCase();
}

function recentPenalty(
  candidate: PlaybackQueueItem,
  recent: PlaybackQueueItem[],
  tracksById: Record<string, LibraryTrack>,
): number {
  const candidateTrack = tracksById[candidate.trackId];
  const candidateArtist = trackKey(candidateTrack, "artist");
  const candidateAlbum = trackKey(candidateTrack, "album");

  return recent.reduce((penalty, item, index) => {
    const track = tracksById[item.trackId];
    const distanceWeight = recent.length - index;
    let nextPenalty = penalty;
    if (candidateArtist && candidateArtist === trackKey(track, "artist")) {
      nextPenalty += 6 * distanceWeight;
    }
    if (candidateAlbum && candidateAlbum === trackKey(track, "album")) {
      nextPenalty += 3 * distanceWeight;
    }
    return nextPenalty;
  }, 0);
}

export function smartShuffleQueue(
  items: PlaybackQueueItem[],
  activeItemId: string | null,
  tracksById: Record<string, LibraryTrack>,
): PlaybackQueueItem[] {
  if (items.length <= 2) return [...items];

  const activeItem = activeItemId ? items.find((item) => item.id === activeItemId) || null : null;
  const remaining = shuffled(items.filter((item) => item.id !== activeItem?.id));
  const next = activeItem ? [activeItem] : [];
  const recentWindowSize = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(items.length))));

  while (remaining.length > 0) {
    const recent = next.slice(-recentWindowSize);
    let bestIndex = 0;
    let bestScore = Number.POSITIVE_INFINITY;

    for (let index = 0; index < remaining.length; index += 1) {
      const score = recentPenalty(remaining[index], recent, tracksById);
      if (score < bestScore) {
        bestIndex = index;
        bestScore = score;
      }
      if (score === 0) break;
    }

    const [picked] = remaining.splice(bestIndex, 1);
    next.push(picked);
  }

  return next;
}

export function buildQueueFromTracks(
  tracks: LibraryTrack[],
  activeTrackId: string,
  source: PlaybackQueueSource | null,
  tracksById: Record<string, LibraryTrack>,
  shuffleEnabled: boolean,
): PlaybackQueue {
  const startIndex = tracks.findIndex((track) => track.id === activeTrackId);
  const orderedTracks = startIndex === -1 ? tracks : tracks.slice(startIndex);
  const items = orderedTracks.map((track) => createQueueItem(track.id));
  const activeItemId = items[0]?.id || null;

  return {
    items,
    shuffledItems: shuffleEnabled ? smartShuffleQueue(items, activeItemId, tracksById) : [],
    activeItemId,
    source,
    panelOpen: false,
  };
}

export function getVisibleQueueItems(
  queue: PlaybackQueue,
  shuffleEnabled: boolean,
): PlaybackQueueItem[] {
  return shuffleEnabled && queue.shuffledItems.length > 0 ? queue.shuffledItems : queue.items;
}

export function getActiveQueueIndex(queue: PlaybackQueue, shuffleEnabled: boolean): number {
  const items = getVisibleQueueItems(queue, shuffleEnabled);
  return items.findIndex((item) => item.id === queue.activeItemId);
}

export function setQueueActiveTrack(queue: PlaybackQueue, trackId: string): PlaybackQueue {
  const activeItem =
    queue.items.find((item) => item.trackId === trackId) ||
    queue.shuffledItems.find((item) => item.trackId === trackId) ||
    null;
  return { ...queue, activeItemId: activeItem?.id || queue.activeItemId };
}

export function reorderQueueItems(
  queue: PlaybackQueue,
  itemIds: string[],
  targetItemId: string,
  edge: QueueDropEdge,
  shuffleEnabled: boolean,
): PlaybackQueue {
  const uniqueItemIds = itemIds.filter((itemId, index) => itemIds.indexOf(itemId) === index);
  const key = shuffleEnabled ? "shuffledItems" : "items";
  const items = queue[key];
  const itemIdsToMove = items
    .filter((item) => uniqueItemIds.includes(item.id))
    .map((item) => item.id);
  if (itemIdsToMove.length === 0 || itemIdsToMove.includes(targetItemId)) return queue;

  const nextIds = moveItemsBeforeOrAfter(
    items.map((item) => item.id),
    itemIdsToMove,
    targetItemId,
    edge,
  );
  const itemsById = new Map(items.map((item) => [item.id, item]));
  return {
    ...queue,
    [key]: nextIds.map((itemId) => itemsById.get(itemId)).filter(Boolean) as PlaybackQueueItem[],
  };
}

export function addTracksToQueue(
  queue: PlaybackQueue,
  trackIds: string[],
  targetItemId: string | null,
  edge: QueueDropEdge,
  shuffleEnabled: boolean,
): PlaybackQueue {
  const itemsToAdd = trackIds.map(createQueueItem);
  if (itemsToAdd.length === 0) return queue;

  const appendOrInsert = (items: PlaybackQueueItem[]) => {
    if (!targetItemId) return [...items, ...itemsToAdd];
    const targetIndex = items.findIndex((item) => item.id === targetItemId);
    if (targetIndex === -1) return [...items, ...itemsToAdd];
    const insertIndex = edge === "after" ? targetIndex + 1 : targetIndex;
    return [...items.slice(0, insertIndex), ...itemsToAdd, ...items.slice(insertIndex)];
  };

  return {
    ...queue,
    items: shuffleEnabled ? [...queue.items, ...itemsToAdd] : appendOrInsert(queue.items),
    shuffledItems: shuffleEnabled ? appendOrInsert(queue.shuffledItems) : queue.shuffledItems,
    activeItemId: queue.activeItemId || itemsToAdd[0]?.id || null,
  };
}

export function removeQueueItem(queue: PlaybackQueue, itemId: string): PlaybackQueue {
  const items = queue.items.filter((item) => item.id !== itemId);
  const shuffledItems = queue.shuffledItems.filter((item) => item.id !== itemId);
  const activeItemId =
    queue.activeItemId === itemId
      ? items[0]?.id || shuffledItems[0]?.id || null
      : queue.activeItemId;
  return { ...queue, items, shuffledItems, activeItemId };
}

export function pruneQueue(queue: PlaybackQueue, validTrackIds: Set<string>): PlaybackQueue {
  const items = queue.items.filter((item) => validTrackIds.has(item.trackId));
  const validItemIds = new Set(items.map((item) => item.id));
  const shuffledItems = queue.shuffledItems.filter(
    (item) => validItemIds.has(item.id) && validTrackIds.has(item.trackId),
  );
  const activeItemId =
    queue.activeItemId && validItemIds.has(queue.activeItemId)
      ? queue.activeItemId
      : items[0]?.id || null;
  return { ...queue, items, shuffledItems, activeItemId };
}
