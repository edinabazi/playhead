import { useCallback } from "react";
import type {
  LibraryPlaylist,
  LibraryState,
  LibraryTag,
  LibraryTrack,
} from "../../../../shared/library";
import { showSimpleActionToast, showTrackActionToast } from "@/features/toasts/action-toasts";
import { createPlaylist, createTag } from "./library-model";

function uniqueValidTrackIds(
  trackIds: string[],
  tracks: LibraryState["tracks"],
  blockedTrackIds = new Set<string>(),
): string[] {
  const seen = new Set<string>();
  const nextTrackIds: string[] = [];

  for (const trackId of trackIds) {
    if (!tracks[trackId] || blockedTrackIds.has(trackId) || seen.has(trackId)) continue;
    seen.add(trackId);
    nextTrackIds.push(trackId);
  }

  return nextTrackIds;
}

export function useLibraryActions({
  library,
  persistLibrary,
  setIsCreatePlaylistOpen,
  setTracksPendingPlaylistCreation,
  setIsCreateTagOpen,
  setTracksPendingTagCreation,
  setPlaylistTrackIdsPendingRemoval,
  setRenamingPlaylistId,
  setRenamingTagId,
}: {
  library: LibraryState;
  persistLibrary: (nextState: LibraryState) => Promise<void>;
  setIsCreatePlaylistOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setTracksPendingPlaylistCreation: React.Dispatch<React.SetStateAction<LibraryTrack[]>>;
  setIsCreateTagOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setTracksPendingTagCreation: React.Dispatch<React.SetStateAction<LibraryTrack[]>>;
  setPlaylistTrackIdsPendingRemoval: React.Dispatch<React.SetStateAction<string[]>>;
  setRenamingPlaylistId: React.Dispatch<React.SetStateAction<string | null>>;
  setRenamingTagId: React.Dispatch<React.SetStateAction<string | null>>;
}) {
  const createNewPlaylist = useCallback(
    async (name: string, tracksToAdd: LibraryTrack[] = []) => {
      const playlist = createPlaylist(library.playlists, name);
      const trackIdsToAdd = uniqueValidTrackIds(
        tracksToAdd.map((track) => track.id),
        library.tracks,
      );
      const now = new Date().toISOString();

      await persistLibrary({
        ...library,
        playlists: [
          ...library.playlists,
          trackIdsToAdd.length > 0
            ? { ...playlist, trackIds: trackIdsToAdd, updatedAt: now }
            : playlist,
        ],
        selectedSource: { type: "playlist", id: playlist.id },
      });
      window.playhead.trackEvent("playlist_created", {
        from_track: trackIdsToAdd.length > 0,
      });

      if (trackIdsToAdd.length === 1) {
        const track = tracksToAdd.find((item) => item.id === trackIdsToAdd[0]);
        if (track) {
          showTrackActionToast({
            action: "Playlist created",
            track,
            detail: `Added to ${playlist.name}`,
          });
        }
      } else if (trackIdsToAdd.length > 1) {
        showSimpleActionToast(`${trackIdsToAdd.length} tracks added to ${playlist.name}.`);
      } else {
        showSimpleActionToast(`Playlist created: ${playlist.name}`);
      }

      setIsCreatePlaylistOpen(false);
      setTracksPendingPlaylistCreation([]);
    },
    [library, persistLibrary, setIsCreatePlaylistOpen, setTracksPendingPlaylistCreation],
  );

  const createNewTag = useCallback(
    async (name: string, tracksToAdd: LibraryTrack[] = []) => {
      const trimmedName = name.trim();
      if (!trimmedName) return;
      const duplicate = (library.tags || []).some(
        (tag) => tag.name.trim().toLowerCase() === trimmedName.toLowerCase(),
      );
      if (duplicate) {
        showSimpleActionToast(`Tag already exists: ${trimmedName}`);
        return;
      }

      const tag = createTag(library.tags || [], trimmedName);
      const trackIdsToAdd = uniqueValidTrackIds(
        tracksToAdd.map((track) => track.id),
        library.tracks,
      );
      const now = new Date().toISOString();

      await persistLibrary({
        ...library,
        tags: [
          ...(library.tags || []),
          trackIdsToAdd.length > 0 ? { ...tag, trackIds: trackIdsToAdd, updatedAt: now } : tag,
        ],
        selectedSource: { type: "tag", id: tag.id },
      });
      showSimpleActionToast(
        trackIdsToAdd.length > 0
          ? `${trackIdsToAdd.length} ${trackIdsToAdd.length === 1 ? "track" : "tracks"} tagged ${tag.name}.`
          : `Tag created: ${tag.name}`,
      );

      setIsCreateTagOpen(false);
      setTracksPendingTagCreation([]);
    },
    [library, persistLibrary, setIsCreateTagOpen, setTracksPendingTagCreation],
  );

  const renamePlaylist = useCallback(
    async (playlistId: string, name: string) => {
      const playlist = library.playlists.find((item) => item.id === playlistId);
      if (!playlist) return;

      const trimmedName = name.trim();
      if (!trimmedName || trimmedName === playlist.name) {
        setRenamingPlaylistId(null);
        return;
      }
      const now = new Date().toISOString();

      await persistLibrary({
        ...library,
        playlists: library.playlists.map((item) =>
          item.id === playlistId ? { ...item, name: trimmedName, updatedAt: now } : item,
        ),
      });
      setRenamingPlaylistId(null);
    },
    [library, persistLibrary, setRenamingPlaylistId],
  );

  const deletePlaylist = useCallback(
    async (playlistId: string) => {
      const deletedPlaylist = library.playlists.find((playlist) => playlist.id === playlistId);
      const nextPlaylists = library.playlists.filter((playlist) => playlist.id !== playlistId);

      await persistLibrary({
        ...library,
        playlists: nextPlaylists,
        selectedSource:
          library.selectedSource?.type === "playlist" && library.selectedSource.id === playlistId
            ? library.folders[0]
              ? { type: "folder", id: library.folders[0].id }
              : null
            : library.selectedSource,
      });
      if (deletedPlaylist) showSimpleActionToast(`Playlist deleted: ${deletedPlaylist.name}`);
    },
    [library, persistLibrary],
  );

  const renameTag = useCallback(
    async (tagId: string, name: string) => {
      const tag = (library.tags || []).find((item) => item.id === tagId);
      if (!tag) return;

      const trimmedName = name.trim();
      if (!trimmedName || trimmedName === tag.name) {
        setRenamingTagId(null);
        return;
      }
      const duplicate = (library.tags || []).some(
        (item) => item.id !== tagId && item.name.trim().toLowerCase() === trimmedName.toLowerCase(),
      );
      if (duplicate) {
        showSimpleActionToast(`Tag already exists: ${trimmedName}`);
        return;
      }
      const now = new Date().toISOString();

      await persistLibrary({
        ...library,
        tags: (library.tags || []).map((item) =>
          item.id === tagId ? { ...item, name: trimmedName, updatedAt: now } : item,
        ),
      });
      setRenamingTagId(null);
    },
    [library, persistLibrary, setRenamingTagId],
  );

  const deleteTag = useCallback(
    async (tagId: string) => {
      const deletedTag = (library.tags || []).find((tag) => tag.id === tagId);
      const nextTags = (library.tags || []).filter((tag) => tag.id !== tagId);

      await persistLibrary({
        ...library,
        tags: nextTags,
        selectedSource:
          library.selectedSource?.type === "tag" && library.selectedSource.id === tagId
            ? library.settings.library.mode === "library"
              ? { type: "library-tracks" }
              : library.folders[0]
                ? { type: "folder", id: library.folders[0].id }
                : library.playlists[0]
                  ? { type: "playlist", id: library.playlists[0].id }
                  : nextTags[0]
                    ? { type: "tag", id: nextTags[0].id }
                    : null
            : library.selectedSource,
      });
      if (deletedTag) showSimpleActionToast(`Tag deleted: ${deletedTag.name}`);
    },
    [library, persistLibrary],
  );

  const removeTracksFromSelectedPlaylist = useCallback(
    async (trackIds: string[]) => {
      const source = library.selectedSource;
      if (!source || source.type !== "playlist") return;
      const trackIdsToRemove = new Set(trackIds);
      if (trackIdsToRemove.size === 0) return;
      const now = new Date().toISOString();

      await persistLibrary({
        ...library,
        playlists: library.playlists.map((playlist) =>
          playlist.id === source.id
            ? {
                ...playlist,
                trackIds: playlist.trackIds.filter((item) => !trackIdsToRemove.has(item)),
                updatedAt: now,
              }
            : playlist,
        ),
      });
    },
    [library, persistLibrary],
  );

  const requestRemoveTracksFromSelectedPlaylist = useCallback(
    (trackIds: string[]) => {
      if (trackIds.length > 1) {
        setPlaylistTrackIdsPendingRemoval(trackIds);
        return;
      }

      void removeTracksFromSelectedPlaylist(trackIds);
    },
    [removeTracksFromSelectedPlaylist, setPlaylistTrackIdsPendingRemoval],
  );

  const addTrackToPlaylist = useCallback(
    async (trackId: string, playlist: LibraryPlaylist) => {
      if (playlist.trackIds.includes(trackId)) return;
      const track = library.tracks[trackId];
      const now = new Date().toISOString();

      await persistLibrary({
        ...library,
        playlists: library.playlists.map((item) =>
          item.id === playlist.id
            ? { ...item, trackIds: [...item.trackIds, trackId], updatedAt: now }
            : item,
        ),
      });
      if (track) {
        showTrackActionToast({
          action: "Added to playlist",
          track,
          detail: playlist.name,
        });
      }
    },
    [library, persistLibrary],
  );

  const addTracksToPlaylist = useCallback(
    async (trackIds: string[], playlist: LibraryPlaylist) => {
      const trackIdsToAdd = uniqueValidTrackIds(
        trackIds,
        library.tracks,
        new Set(playlist.trackIds),
      );
      if (trackIdsToAdd.length === 0) return;

      const now = new Date().toISOString();
      await persistLibrary({
        ...library,
        playlists: library.playlists.map((item) =>
          item.id === playlist.id
            ? { ...item, trackIds: [...item.trackIds, ...trackIdsToAdd], updatedAt: now }
            : item,
        ),
      });

      const firstTrack = library.tracks[trackIdsToAdd[0]];
      if (trackIdsToAdd.length === 1 && firstTrack) {
        showTrackActionToast({
          action: "Added to playlist",
          track: firstTrack,
          detail: playlist.name,
        });
        return;
      }

      showSimpleActionToast(`${trackIdsToAdd.length} tracks added to ${playlist.name}.`);
    },
    [library, persistLibrary],
  );

  const addTracksToTag = useCallback(
    async (trackIds: string[], tag: LibraryTag) => {
      const trackIdsToAdd = uniqueValidTrackIds(trackIds, library.tracks, new Set(tag.trackIds));
      if (trackIdsToAdd.length === 0) return;

      const now = new Date().toISOString();
      await persistLibrary({
        ...library,
        tags: (library.tags || []).map((item) =>
          item.id === tag.id
            ? { ...item, trackIds: [...item.trackIds, ...trackIdsToAdd], updatedAt: now }
            : item,
        ),
      });

      const firstTrack = library.tracks[trackIdsToAdd[0]];
      if (trackIdsToAdd.length === 1 && firstTrack) {
        showTrackActionToast({
          action: "Tagged",
          track: firstTrack,
          detail: tag.name,
        });
        return;
      }

      showSimpleActionToast(`${trackIdsToAdd.length} tracks tagged ${tag.name}.`);
    },
    [library, persistLibrary],
  );

  const removeTracksFromSelectedTag = useCallback(
    async (trackIds: string[]) => {
      const source = library.selectedSource;
      if (!source || source.type !== "tag") return;
      const trackIdsToRemove = new Set(trackIds);
      if (trackIdsToRemove.size === 0) return;
      const now = new Date().toISOString();

      await persistLibrary({
        ...library,
        tags: (library.tags || []).map((tag) =>
          tag.id === source.id
            ? {
                ...tag,
                trackIds: tag.trackIds.filter((item) => !trackIdsToRemove.has(item)),
                updatedAt: now,
              }
            : tag,
        ),
      });
    },
    [library, persistLibrary],
  );

  return {
    createNewPlaylist,
    createNewTag,
    renamePlaylist,
    deletePlaylist,
    renameTag,
    deleteTag,
    removeTracksFromSelectedPlaylist,
    requestRemoveTracksFromSelectedPlaylist,
    addTrackToPlaylist,
    addTracksToPlaylist,
    addTracksToTag,
    removeTracksFromSelectedTag,
  };
}
