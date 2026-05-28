import type { LibraryTrack } from "../../../shared/library";

export function getArtworkSrc(track: LibraryTrack): string | null {
  return track.artwork?.dataUrl || track.artwork?.src || null;
}

export function getMediaArtworkSrc(track: LibraryTrack): string | null {
  return track.source === "soundcloud"
    ? track.soundcloud?.artworkUrl || getArtworkSrc(track)
    : getArtworkSrc(track);
}
