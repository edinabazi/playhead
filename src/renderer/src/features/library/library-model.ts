import {
  emptyLibraryState,
  type LibraryPlaylist,
  type LibraryState,
  type LibraryTrack,
  type ScannedFolder,
} from "../../../../shared/library";

const playlistName = "New Playlist";

export { emptyLibraryState };

export function mergeScannedFolder(state: LibraryState, scanned: ScannedFolder): LibraryState {
  const tracks = Object.fromEntries(
    Object.entries(state.tracks).filter(([, track]) => track.folderId !== scanned.folder.id),
  );
  for (const track of scanned.tracks) tracks[track.id] = track;

  const folders = [
    ...state.folders.filter((folder) => folder.id !== scanned.folder.id),
    scanned.folder,
  ];

  const validTrackIds = new Set(Object.values(tracks).map((track) => track.id));
  const playlists = state.playlists.map((playlist) => ({
    ...playlist,
    trackIds: playlist.trackIds.filter((trackId) => validTrackIds.has(trackId)),
  }));

  return {
    ...state,
    folders,
    tracks,
    playlists,
    selectedSource: { type: "folder", id: scanned.folder.id },
  };
}

export function getSourceTracks(state: LibraryState): LibraryTrack[] {
  const source = state.selectedSource;
  if (!source) return [];

  if (source.type === "loved") {
    return (state.favoriteTrackIds || [])
      .map((trackId) => state.tracks[trackId])
      .filter((track): track is LibraryTrack => Boolean(track));
  }

  const sourceIds =
    source.type === "folder"
      ? state.folders.find((folder) => folder.id === source.id)?.trackIds
      : state.playlists.find((playlist) => playlist.id === source.id)?.trackIds;

  return (sourceIds || [])
    .map((trackId) => state.tracks[trackId])
    .filter((track): track is LibraryTrack => Boolean(track));
}

export function createPlaylist(existing: LibraryPlaylist[], name?: string): LibraryPlaylist {
  const now = new Date().toISOString();
  const nextNumber = existing.length + 1;
  const fallbackName = nextNumber === 1 ? playlistName : `${playlistName} ${nextNumber}`;

  return {
    id: `playlist-${crypto.randomUUID()}`,
    name: name?.trim() || fallbackName,
    trackIds: [],
    createdAt: now,
    updatedAt: now,
  };
}
