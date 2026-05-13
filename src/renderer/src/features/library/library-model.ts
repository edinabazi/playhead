import {
  emptyLibraryState,
  type LibraryPlaylist,
  type LibraryState,
  type LibraryTag,
  type LibraryTrack,
  type ScannedFolder,
} from "../../../../shared/library";

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
  const tracks = Object.fromEntries(
    Object.entries(state.tracks).filter(([, track]) => track.folderId !== scanned.folder.id),
  );
  for (const track of scanned.tracks) {
    const existing = state.tracks[track.id];
    tracks[track.id] =
      track.bpm || !existing?.bpm || existing.bpmSource !== "analysis"
        ? track
        : { ...track, bpm: existing.bpm, bpmSource: "analysis" };
  }

  const folders = [
    ...state.folders.filter((folder) => folder.id !== scanned.folder.id),
    scanned.folder,
  ];

  const validTrackIds = new Set(Object.values(tracks).map((track) => track.id));
  const playlists = state.playlists.map((playlist) => ({
    ...playlist,
    trackIds: playlist.trackIds.filter((trackId) => validTrackIds.has(trackId)),
  }));
  const tags = (state.tags || []).map((tag) => ({
    ...tag,
    trackIds: tag.trackIds.filter((trackId) => validTrackIds.has(trackId)),
  }));

  return {
    ...state,
    folders,
    tracks,
    playlists,
    tags,
    selectedSource: { type: "folder", id: scanned.folder.id },
  };
}

export function getAllLibraryTracks(state: LibraryState): LibraryTrack[] {
  return sortTracksByTitle(Object.values(state.tracks));
}

export function getLibraryArtists(state: LibraryState): LibraryArtist[] {
  const artists = new Map<string, LibraryArtist>();
  const artworkSourcesByArtist = new Map<string, Set<string>>();

  for (const track of Object.values(state.tracks)) {
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
  }

  return Array.from(artists.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function getLibraryAlbums(state: LibraryState): LibraryAlbum[] {
  const albums = new Map<string, LibraryAlbum>();

  for (const track of Object.values(state.tracks)) {
    const id = getTrackAlbumId(track);
    const album = albums.get(id) || {
      id,
      title: getTrackAlbum(track),
      artist: getTrackArtist(track),
      artwork: track.artwork,
      trackIds: [],
      year: track.year,
    };
    album.trackIds.push(track.id);
    if (!album.artwork && track.artwork) album.artwork = track.artwork;
    if (!album.year && track.year) album.year = track.year;
    albums.set(id, album);
  }

  return Array.from(albums.values()).sort((a, b) => a.title.localeCompare(b.title));
}

export function getSourceTracks(state: LibraryState): LibraryTrack[] {
  const source = state.selectedSource;
  if (!source) return [];

  if (source.type === "library-tracks") return getAllLibraryTracks(state);

  if (source.type === "library-artist") {
    return sortTracksByTitle(
      Object.values(state.tracks).filter(
        (track) => getTrackArtistId(track) === source.id,
      ),
    );
  }

  if (source.type === "library-album") {
    return sortAlbumTracks(
      Object.values(state.tracks).filter((track) => getTrackAlbumId(track) === source.id),
    );
  }

  if (source.type === "library-artists" || source.type === "library-albums") return [];

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
