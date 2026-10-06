import { useCallback } from "react";
import { showSimpleActionToast } from "@/features/toasts/action-toasts";
import { getErrorMessage } from "@/lib/errors";
import type {
  LibraryState,
  LibraryTrack,
  SoundCloudCollection,
  SoundCloudPlaylistEdit,
} from "../../../../shared/library";
import { applySoundCloudPlaylistEdit } from "../../../../shared/soundcloud-playlist";

/** Edits to the user's SoundCloud playlists, keeping the loaded collections in step. */
export function useSoundCloudPlaylistActions({
  soundcloudCollections,
  setSoundCloudCollections,
  soundcloudTracksByCollection,
  setSoundCloudTracksByCollection,
  soundcloudTracksRef,
  allPlayableTracksById,
  selectedSource,
  libraryRef,
  selectLibrarySource,
}: {
  soundcloudCollections: SoundCloudCollection[];
  soundcloudTracksByCollection: Record<string, LibraryTrack[]>;
  setSoundCloudCollections: React.Dispatch<React.SetStateAction<SoundCloudCollection[]>>;
  setSoundCloudTracksByCollection: React.Dispatch<
    React.SetStateAction<Record<string, LibraryTrack[]>>
  >;
  soundcloudTracksRef: React.MutableRefObject<Record<string, LibraryTrack>>;
  allPlayableTracksById: Record<string, LibraryTrack>;
  selectedSource: LibraryState["selectedSource"];
  libraryRef: React.MutableRefObject<LibraryState>;
  selectLibrarySource: (source: LibraryState["selectedSource"]) => void;
}) {
  const storeSoundCloudPlaylistTracks = useCallback(
    (collectionId: string, tracks: LibraryTrack[]) => {
      setSoundCloudTracksByCollection((current) => ({ ...current, [collectionId]: tracks }));
      setSoundCloudCollections((current) =>
        current.map((collection) =>
          collection.id === collectionId
            ? { ...collection, trackCount: tracks.length }
            : collection,
        ),
      );
      soundcloudTracksRef.current = {
        ...soundcloudTracksRef.current,
        ...Object.fromEntries(tracks.map((track) => [track.id, track])),
      };
    },
    [setSoundCloudCollections, setSoundCloudTracksByCollection, soundcloudTracksRef],
  );

  const toSoundCloudIds = useCallback(
    (trackIds: string[]) =>
      trackIds.flatMap((trackId) => {
        const id = allPlayableTracksById[trackId]?.soundcloud?.id;
        return id === undefined ? [] : [id];
      }),
    [allPlayableTracksById],
  );

  const editSoundCloudPlaylist = useCallback(
    async (collectionId: string, edit: SoundCloudPlaylistEdit) => {
      const { changed, tracks } = await window.playhead.editSoundCloudPlaylist(collectionId, edit);
      storeSoundCloudPlaylistTracks(collectionId, tracks);
      return changed;
    },
    [storeSoundCloudPlaylistTracks],
  );

  const soundCloudCollectionTitle = useCallback(
    (collectionId: string) =>
      soundcloudCollections.find((collection) => collection.id === collectionId)?.title ||
      "playlist",
    [soundcloudCollections],
  );

  const addTracksToSoundCloudPlaylist = useCallback(
    async (trackIds: string[], playlist: SoundCloudCollection, move = false) => {
      const soundcloudIds = toSoundCloudIds(trackIds);
      if (soundcloudIds.length === 0) {
        showSimpleActionToast(
          "Only SoundCloud tracks can be added to SoundCloud playlists.",
          "info",
        );
        return;
      }
      // Moving only makes sense out of another SoundCloud playlist.
      const source = selectedSource;
      const moveFrom =
        move &&
        source?.type === "soundcloud" &&
        source.id?.startsWith("playlist:") &&
        source.id !== playlist.id
          ? source.id
          : null;
      try {
        const added = await editSoundCloudPlaylist(playlist.id, {
          type: "add",
          trackIds: soundcloudIds,
        });
        if (moveFrom) {
          await editSoundCloudPlaylist(moveFrom, { type: "remove", trackIds: soundcloudIds });
          showSimpleActionToast(
            `Moved ${soundcloudIds.length} ${soundcloudIds.length === 1 ? "track" : "tracks"} to ${playlist.title}`,
          );
          return;
        }
        showSimpleActionToast(
          added === 0
            ? `Already in ${playlist.title}`
            : `Added ${added} ${added === 1 ? "track" : "tracks"} to ${playlist.title}`,
          added === 0 ? "info" : "success",
        );
      } catch (error) {
        showSimpleActionToast(
          getErrorMessage(error, "Could not update the SoundCloud playlist."),
          "error",
        );
      }
    },
    [editSoundCloudPlaylist, selectedSource, toSoundCloudIds],
  );

  const createSoundCloudPlaylist = useCallback(
    async (title: string, tracksToAdd: LibraryTrack[]) => {
      try {
        const collection = await window.playhead.createSoundCloudPlaylist(
          title,
          toSoundCloudIds(tracksToAdd.map((track) => track.id)),
        );
        setSoundCloudCollections((current) => {
          // Keep playlists together, newest first, ahead of the other collections.
          const playlists = current.filter((item) => item.id.startsWith("playlist:"));
          const others = current.filter((item) => !item.id.startsWith("playlist:"));
          return [collection, ...playlists, ...others];
        });
        showSimpleActionToast(`Created ${collection.title} on SoundCloud (private)`);
      } catch (error) {
        showSimpleActionToast(
          getErrorMessage(error, "Could not create the SoundCloud playlist."),
          "error",
        );
      }
    },
    [setSoundCloudCollections, toSoundCloudIds],
  );

  const renameSoundCloudPlaylist = useCallback(
    async (collection: SoundCloudCollection, title: string) => {
      const rename = (nextTitle: string) =>
        setSoundCloudCollections((current) =>
          current.map((item) => (item.id === collection.id ? { ...item, title: nextTitle } : item)),
        );
      rename(title);
      try {
        await window.playhead.renameSoundCloudPlaylist(collection.id, title);
      } catch (error) {
        rename(collection.title);
        showSimpleActionToast(
          getErrorMessage(error, "Could not rename the SoundCloud playlist."),
          "error",
        );
      }
    },
    [setSoundCloudCollections],
  );

  const removeTracksFromSoundCloudPlaylist = useCallback(
    async (collectionId: string, trackIds: string[]) => {
      const soundcloudIds = toSoundCloudIds(trackIds);
      if (soundcloudIds.length === 0) return;
      try {
        const removed = await editSoundCloudPlaylist(collectionId, {
          type: "remove",
          trackIds: soundcloudIds,
        });
        showSimpleActionToast(
          `Removed ${removed} ${removed === 1 ? "track" : "tracks"} from ${soundCloudCollectionTitle(collectionId)}`,
        );
      } catch (error) {
        showSimpleActionToast(
          getErrorMessage(error, "Could not update the SoundCloud playlist."),
          "error",
        );
      }
    },
    [editSoundCloudPlaylist, soundCloudCollectionTitle, toSoundCloudIds],
  );

  const reorderSoundCloudPlaylist = useCallback(
    async (
      collectionId: string,
      trackIds: string[],
      targetTrackId: string,
      edge: "before" | "after" = "before",
    ) => {
      const target = allPlayableTracksById[targetTrackId]?.soundcloud?.id;
      const current = soundcloudTracksByCollection[collectionId];
      if (target === undefined || !current) return;
      const edit = {
        type: "move" as const,
        trackIds: toSoundCloudIds(trackIds),
        targetTrackId: target,
        edge,
      };
      // Reorder locally straight away; SoundCloud's copy follows.
      const byId = new Map(current.map((track) => [track.soundcloud?.id, track]));
      const reordered = applySoundCloudPlaylistEdit(
        current.flatMap((track) => (track.soundcloud ? [track.soundcloud.id] : [])),
        edit,
      ).flatMap((id) => byId.get(id) ?? []);
      storeSoundCloudPlaylistTracks(collectionId, reordered);
      try {
        await editSoundCloudPlaylist(collectionId, edit);
      } catch (error) {
        storeSoundCloudPlaylistTracks(collectionId, current);
        showSimpleActionToast(
          getErrorMessage(error, "Could not reorder the SoundCloud playlist."),
          "error",
        );
      }
    },
    [
      allPlayableTracksById,
      editSoundCloudPlaylist,
      soundcloudTracksByCollection,
      storeSoundCloudPlaylistTracks,
      toSoundCloudIds,
    ],
  );

  const deleteSoundCloudPlaylist = useCallback(
    async (collection: SoundCloudCollection) => {
      try {
        await window.playhead.deleteSoundCloudPlaylist(collection.id);
      } catch (error) {
        showSimpleActionToast(
          getErrorMessage(error, "Could not delete the SoundCloud playlist."),
          "error",
        );
        return;
      }
      setSoundCloudCollections((current) => current.filter((item) => item.id !== collection.id));
      setSoundCloudTracksByCollection((current) => {
        const next = { ...current };
        delete next[collection.id];
        return next;
      });
      const source = libraryRef.current.selectedSource;
      if (source?.type === "soundcloud" && source.id === collection.id) {
        const folder = libraryRef.current.folders[0];
        selectLibrarySource(folder ? { type: "folder", id: folder.id } : null);
      }
      showSimpleActionToast(`Deleted ${collection.title} from SoundCloud`);
    },
    [libraryRef, selectLibrarySource, setSoundCloudCollections, setSoundCloudTracksByCollection],
  );

  return {
    soundCloudCollectionTitle,
    addTracksToSoundCloudPlaylist,
    createSoundCloudPlaylist,
    renameSoundCloudPlaylist,
    removeTracksFromSoundCloudPlaylist,
    reorderSoundCloudPlaylist,
    deleteSoundCloudPlaylist,
  };
}
