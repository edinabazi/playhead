import { useCallback, useMemo } from "react";
import type { LibraryState, LibraryTrack, PlaybackQueueItem } from "../../../../shared/library";
import { showSimpleActionToast } from "@/features/toasts/action-toasts";
import {
  addTracksToQueue,
  getVisibleQueueItems,
  removeQueueItem,
  reorderQueueItems,
  type QueueDropEdge,
} from "./queue-model";

export function usePlaybackQueue({
  library,
  tracksById = library.tracks,
  shuffleEnabled,
  persistSessionSettings,
  selectTrack,
  setSelectedTrackIds,
  setScrollToTrackId,
}: {
  library: LibraryState;
  tracksById?: Record<string, LibraryTrack>;
  shuffleEnabled: boolean;
  persistSessionSettings: (nextSession: LibraryState["settings"]["session"]) => void;
  selectTrack: (
    track: LibraryTrack,
    autoplay?: boolean,
    startTime?: number,
    allowSkipUnavailable?: boolean,
    queueMode?: "preserve" | "source",
    activeQueueItemId?: string,
  ) => Promise<void>;
  setSelectedTrackIds: React.Dispatch<React.SetStateAction<string[]>>;
  setScrollToTrackId: React.Dispatch<React.SetStateAction<string | null>>;
}) {
  const queue = library.settings.session.queue;
  const items = useMemo(() => getVisibleQueueItems(queue, shuffleEnabled), [queue, shuffleEnabled]);

  const updateQueue = useCallback(
    (nextQueue: LibraryState["settings"]["session"]["queue"]) => {
      persistSessionSettings({
        ...library.settings.session,
        queue: nextQueue,
      });
    },
    [library.settings.session, persistSessionSettings],
  );

  const togglePanel = useCallback(() => {
    updateQueue({
      ...queue,
      panelOpen: !queue.panelOpen,
    });
  }, [queue, updateQueue]);

  const playItem = useCallback(
    (item: PlaybackQueueItem) => {
      const track = tracksById[item.trackId];
      if (!track) return;

      updateQueue({ ...queue, activeItemId: item.id });
      setSelectedTrackIds([track.id]);
      setScrollToTrackId(track.id);
      void selectTrack(track, true, 0, false, "preserve", item.id);
    },
    [tracksById, queue, selectTrack, setScrollToTrackId, setSelectedTrackIds, updateQueue],
  );

  const reorderItems = useCallback(
    (itemIds: string[], targetItemId: string, edge: QueueDropEdge) => {
      updateQueue(reorderQueueItems(queue, itemIds, targetItemId, edge, shuffleEnabled));
    },
    [queue, shuffleEnabled, updateQueue],
  );

  const addTracks = useCallback(
    (trackIds: string[], targetItemId: string | null, edge: QueueDropEdge) => {
      const validTrackIds = trackIds.filter((trackId) => tracksById[trackId]);
      if (validTrackIds.length === 0) return;

      updateQueue(addTracksToQueue(queue, validTrackIds, targetItemId, edge, shuffleEnabled));
      showSimpleActionToast(
        validTrackIds.length === 1
          ? "Track added to queue."
          : `${validTrackIds.length} tracks added to queue.`,
      );
    },
    [tracksById, queue, shuffleEnabled, updateQueue],
  );

  const removeItem = useCallback(
    (item: PlaybackQueueItem) => {
      updateQueue(removeQueueItem(queue, item.id));
    },
    [queue, updateQueue],
  );

  return {
    items,
    panelOpen: queue.panelOpen,
    activeItemId: queue.activeItemId,
    togglePanel,
    playItem,
    reorderItems,
    addTracks,
    removeItem,
  };
}
