import { useCallback, useEffect, useState } from "react";
import { showSimpleActionToast } from "@/features/toasts/action-toasts";
import { getErrorMessage } from "@/lib/errors";
import type { LibraryTrack, SoundCloudCollection } from "../../../../shared/library";

/**
 * SoundCloud likes mirrored onto hearts when like sync is on: loads the user's liked track
 * ids and likes or unlikes tracks on SoundCloud.
 */
export function useSoundCloudLikes({
  connected,
  likeSyncEnabled,
  setSoundCloudCollections,
  setSoundCloudTracksByCollection,
}: {
  connected: boolean;
  likeSyncEnabled: boolean;
  setSoundCloudCollections: React.Dispatch<React.SetStateAction<SoundCloudCollection[]>>;
  setSoundCloudTracksByCollection: React.Dispatch<
    React.SetStateAction<Record<string, LibraryTrack[]>>
  >;
}) {
  const [soundcloudLikedTrackIds, setSoundCloudLikedTrackIds] = useState<Set<string>>(
    () => new Set(),
  );
  useEffect(() => {
    if (!connected || !likeSyncEnabled) {
      setSoundCloudLikedTrackIds(new Set());
      return;
    }
    let cancelled = false;
    void window.playhead
      .getSoundCloudCollectionTracks("liked-tracks")
      .then((tracks) => {
        if (!cancelled) setSoundCloudLikedTrackIds(new Set(tracks.map((track) => track.id)));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [likeSyncEnabled, connected]);

  const syncSoundCloudLike = useCallback(
    async (track: LibraryTrack, liked: boolean) => {
      const soundcloud = track.soundcloud;
      if (!soundcloud) return;
      const apply = (isLiked: boolean) => {
        setSoundCloudLikedTrackIds((current) => {
          const next = new Set(current);
          if (isLiked) next.add(track.id);
          else next.delete(track.id);
          return next;
        });
        // Keep an already loaded Loved Tracks collection in step with the like.
        setSoundCloudTracksByCollection((current) => {
          const likedTracks = current["liked-tracks"];
          if (!likedTracks) return current;
          const without = likedTracks.filter((item) => item.id !== track.id);
          return { ...current, "liked-tracks": isLiked ? [track, ...without] : without };
        });
        setSoundCloudCollections((current) =>
          current.map((collection) =>
            collection.id === "liked-tracks" && collection.trackCount !== undefined
              ? {
                  ...collection,
                  trackCount: Math.max(0, collection.trackCount + (isLiked ? 1 : -1)),
                }
              : collection,
          ),
        );
      };
      apply(liked);
      try {
        await window.playhead.setSoundCloudTrackLiked(soundcloud.id, soundcloud.urn, liked);
      } catch (error) {
        apply(!liked);
        showSimpleActionToast(
          getErrorMessage(error, "Could not update the like on SoundCloud."),
          "error",
        );
      }
    },
    [setSoundCloudCollections, setSoundCloudTracksByCollection],
  );

  return { soundcloudLikedTrackIds, syncSoundCloudLike };
}
