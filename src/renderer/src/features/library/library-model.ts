import {
  emptyLibraryState,
  type LibraryPlaylist,
  type LibraryState,
  type LibraryTag,
  type LibraryTrack,
  type ScannedFolder,
} from "../../../../shared/library";
import { isPathInFolder } from "./folder-tree";
import { buildSmartPlaylistContext, matchesSmartPlaylist } from "../../../../shared/smart-playlist";

const playlistName = "New Playlist";
const tagName = "New Tag";
const unknownArtist = "Unknown Artist";
const unknownAlbum = "Unknown Album";

export { emptyLibraryState };

export type LibraryArtist = {
  id: string;
  name: string;
  artworkSet: LibraryTrack["artwork"][];
  trackIds: string[];
};

export type LibraryAlbum = {
  id: string;
  title: string;
  artist: string;
  artwork?: LibraryTrack["artwork"];
  trackIds: string[];
  year?: number;
};

export type LibraryCollections = {
  artists: LibraryArtist[];
  albums: LibraryAlbum[];
};

export type LibrarySourceParts = Pick<
  LibraryState,
  "favoriteTrackIds" | "folders" | "playlists" | "selectedSource" | "tags" | "tracks"
> &
  Pick<Partial<LibraryState>, "smartPlaylists">;

export function getLibraryKey(value: string): string {
  return value.trim().toLowerCase() || "unknown";
}

export function getTrackArtist(track: LibraryTrack): string {
  return track.albumArtist || track.artist || unknownArtist;
}

export function getTrackAlbum(track: LibraryTrack): string {
  return track.album || unknownAlbum;
}

export function getTrackArtistId(track: LibraryTrack): string {
  return getLibraryKey(getTrackArtist(track));
}

export function getTrackAlbumId(track: LibraryTrack): string {
  return `${getTrackArtistId(track)}::${getLibraryKey(getTrackAlbum(track))}`;
}

function sortTracksByTitle(tracks: LibraryTrack[]): LibraryTrack[] {
  return tracks.slice().sort((a, b) => a.title.localeCompare(b.title));
}

function sortAlbumTracks(tracks: LibraryTrack[]): LibraryTrack[] {
  return tracks.slice().sort((a, b) => {
    const diskDelta = (a.diskNumber || 0) - (b.diskNumber || 0);
    if (diskDelta !== 0) return diskDelta;
    const trackDelta = (a.trackNumber || 0) - (b.trackNumber || 0);
    if (trackDelta !== 0) return trackDelta;
    return a.title.localeCompare(b.title);
  });
}

export function mergeScannedFolder(state: LibraryState, scanned: ScannedFolder): LibraryState {
  const tracks = { ...state.tracks };
  for (const track of scanned.tracks) {
    const existing = state.tracks[track.id];
    tracks[track.id] =
      track.bpm || !existing?.bpm || existing.bpmSource !== "analysis"
        ? track
        : { ...track, bpm: existing.bpm, bpmSource: "analysis" };
  }

  const existingFolder = state.folders.find((folder) => folder.id === scanned.folder.id);
  const scannedTrackIds = new Set(scanned.folder.trackIds);
  const folderTrackIds = Array.from(
    new Set([
      ...(existingFolder?.trackIds || []).filter((trackId) => scannedTrackIds.has(trackId)),
      ...scanned.folder.trackIds,
    ]),
  ).filter((trackId) => Boolean(tracks[trackId]));
  const folder = { ...scanned.folder, trackIds: folderTrackIds };
  const folders = [...state.folders.filter((folder) => folder.id !== scanned.folder.id), folder];

  return mergeScannedLibraryState(state, { ...state, folders, tracks }, [scanned.folder.id], {
    allowNewFolders: true,
    selectedSource: { type: "folder", id: scanned.folder.id },
  });
}

// Apply only completed folder snapshots to the latest state, preserving edits made during a scan.
export function mergeScannedLibraryState(
  latest: LibraryState,
  scannedState: LibraryState,
  scannedFolderIds: Iterable<string>,
  options: {
    allowNewFolders?: boolean;
    selectedSource?: LibraryState["selectedSource"];
    settings?: LibraryState["settings"];
  } = {},
): LibraryState {
  const scannedIds = new Set(scannedFolderIds);
  const scannedFolders = new Map(
    scannedState.folders
      .filter((folder) => scannedIds.has(folder.id))
      .map((folder) => [folder.id, folder]),
  );
  const latestFolderIds = new Set(latest.folders.map((folder) => folder.id));
  const folders = latest.folders.map((folder) => scannedFolders.get(folder.id) || folder);
  if (options.allowNewFolders) {
    for (const folder of scannedFolders.values()) {
      if (!latestFolderIds.has(folder.id)) folders.push(folder);
    }
  }
  const persistedIds = new Set(
    folders.filter((folder) => scannedIds.has(folder.id)).map((folder) => folder.id),
  );
  const previousTrackIds = new Set(
    latest.folders
      .filter((folder) => persistedIds.has(folder.id))
      .flatMap((folder) => folder.trackIds),
  );
  const retainedTrackIds = new Set(folders.flatMap((folder) => folder.trackIds));
  const tracks = { ...latest.tracks };
  const removedIds = new Set<string>();
  for (const track of Object.values(latest.tracks)) {
    if (
      (persistedIds.has(track.folderId) || previousTrackIds.has(track.id)) &&
      !retainedTrackIds.has(track.id)
    ) {
      delete tracks[track.id];
      removedIds.add(track.id);
    }
  }
  for (const folder of folders) {
    if (!persistedIds.has(folder.id)) continue;
    for (const trackId of folder.trackIds) {
      const track = scannedState.tracks[trackId];
      if (!track) continue;
      const existing = latest.tracks[trackId];
      tracks[trackId] =
        !track.bpm && existing?.bpmSource === "analysis"
          ? { ...track, bpm: existing.bpm, bpmSource: "analysis" }
          : track;
    }
  }
  const next = {
    ...latest,
    folders,
    tracks,
    settings: options.settings || latest.settings,
    selectedSource:
      options.selectedSource === undefined ? latest.selectedSource : options.selectedSource,
  };
  if (!removedIds.size) return next;

  const keep = (id: string) => !removedIds.has(id);
  const session = next.settings.session;
  const queue = session.queue;
  const items = queue.items.filter((item) => keep(item.trackId));
  const activeItemId = items.some((item) => item.id === queue.activeItemId)
    ? queue.activeItemId
    : null;
  return {
    ...next,
    playlists: next.playlists.map((playlist) => ({
      ...playlist,
      trackIds: playlist.trackIds.filter(keep),
    })),
    tags: (next.tags || []).map((tag) => ({ ...tag, trackIds: tag.trackIds.filter(keep) })),
    favoriteTrackIds: next.favoriteTrackIds.filter(keep),
    settings: {
      ...next.settings,
      session: {
        ...session,
        activeTrackId:
          session.activeTrackId && keep(session.activeTrackId) ? session.activeTrackId : null,
        selectedTrackIds: session.selectedTrackIds.filter(keep),
        trackPositions: Object.fromEntries(
          Object.entries(session.trackPositions).filter(([id]) => keep(id)),
        ),
        queue: {
          ...queue,
          items,
          shuffledItems: queue.shuffledItems.filter((item) => keep(item.trackId)),
          activeItemId,
        },
      },
    },
  };
}

export function getAllLibraryTracks(state: LibraryState): LibraryTrack[] {
  return sortTracksByTitle(Object.values(state.tracks));
}

export function getLibraryCollectionsFromTracks(
  tracksById: LibraryState["tracks"],
): LibraryCollections {
  const artists = new Map<string, LibraryArtist>();
  const artworkSourcesByArtist = new Map<string, Set<string>>();
  const albums = new Map<string, LibraryAlbum>();

  for (const track of Object.values(tracksById)) {
    const name = getTrackArtist(track);
    const id = getLibraryKey(name);
    const artist = artists.get(id) || { id, name, artworkSet: [], trackIds: [] };
    artist.trackIds.push(track.id);

    const artworkSrc = track.artwork?.dataUrl || track.artwork?.src;
    if (track.artwork && artworkSrc) {
      const artworkSources = artworkSourcesByArtist.get(id) || new Set<string>();
      if (!artworkSources.has(artworkSrc)) {
        artist.artworkSet.push(track.artwork);
        artworkSources.add(artworkSrc);
        artworkSourcesByArtist.set(id, artworkSources);
      }
    }

    artists.set(id, artist);

    const albumId = getTrackAlbumId(track);
    const album = albums.get(albumId) || {
      id: albumId,
      title: getTrackAlbum(track),
      artist: getTrackArtist(track),
      artwork: track.artwork,
      trackIds: [],
      year: track.year,
    };
    album.trackIds.push(track.id);
    if (!album.artwork && track.artwork) album.artwork = track.artwork;
    if (!album.year && track.year) album.year = track.year;
    albums.set(albumId, album);
  }

  return {
    artists: Array.from(artists.values()).sort((a, b) => a.name.localeCompare(b.name)),
    albums: Array.from(albums.values()).sort((a, b) => a.title.localeCompare(b.title)),
  };
}

export function getLibraryCollections(state: LibraryState): LibraryCollections {
  return getLibraryCollectionsFromTracks(state.tracks);
}

export function getLibraryArtists(state: LibraryState): LibraryArtist[] {
  return getLibraryCollections(state).artists;
}

export function getLibraryAlbums(state: LibraryState): LibraryAlbum[] {
  return getLibraryCollections(state).albums;
}

export function getSourceTracksFromParts(state: LibrarySourceParts): LibraryTrack[] {
  const source = state.selectedSource;
  if (!source) return [];

  if (source.type === "library-tracks") return sortTracksByTitle(Object.values(state.tracks));

  if (source.type === "library-artist") {
    return sortTracksByTitle(
      Object.values(state.tracks).filter((track) => getTrackArtistId(track) === source.id),
    );
  }

  if (source.type === "library-album") {
    return sortAlbumTracks(
      Object.values(state.tracks).filter((track) => getTrackAlbumId(track) === source.id),
    );
  }

  if (source.type === "library-artists" || source.type === "library-albums") return [];

  if (source.type === "smart-playlist") {
    const playlist = state.smartPlaylists?.find((item) => item.id === source.id);
    if (!playlist) return [];
    const context = buildSmartPlaylistContext(state.favoriteTrackIds, state.tags);
    return sortTracksByTitle(
      Object.values(state.tracks).filter((track) => matchesSmartPlaylist(track, playlist, context)),
    );
  }

  if (source.type === "loved") {
    return (state.favoriteTrackIds || [])
      .map((trackId) => state.tracks[trackId])
      .filter((track): track is LibraryTrack => Boolean(track));
  }

  if (source.type === "tag") {
    return (
      (state.tags || [])
        .find((tag) => tag.id === source.id)
        ?.trackIds.map((trackId) => state.tracks[trackId])
        .filter((track): track is LibraryTrack => Boolean(track)) || []
    );
  }

  if (source.type === "folder") {
    const folder = state.folders.find((item) => item.id === source.id);
    if (!folder) return [];
    const folderTracks = folder.trackIds
      .map((trackId) => state.tracks[trackId])
      .filter((track): track is LibraryTrack => Boolean(track));
    if (!source.path) return folderTracks;

    const folderPath = source.path || folder.path;
    return folderTracks.filter((track) => isPathInFolder(track.path, folderPath, true));
  }

  return (state.playlists.find((playlist) => playlist.id === source.id)?.trackIds || [])
    .map((trackId) => state.tracks[trackId])
    .filter((track): track is LibraryTrack => Boolean(track));
}

export function getSourceTracks(state: LibraryState): LibraryTrack[] {
  return getSourceTracksFromParts(state);
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

export function createTag(existing: LibraryTag[], name?: string): LibraryTag {
  const now = new Date().toISOString();
  const nextNumber = existing.length + 1;
  const fallbackName = nextNumber === 1 ? tagName : `${tagName} ${nextNumber}`;

  return {
    id: `tag-${crypto.randomUUID()}`,
    name: name?.trim() || fallbackName,
    trackIds: [],
    createdAt: now,
    updatedAt: now,
  };
}
