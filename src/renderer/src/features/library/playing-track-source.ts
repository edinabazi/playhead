import type { LibraryState, LibraryTrack, SelectedSource } from "../../../../shared/library";
import { getSourceTracks } from "./library-model";

export function getPlayingTrackSource(
  library: LibraryState,
  track: LibraryTrack,
  remoteCollections: Record<string, LibraryTrack[]> = {},
): SelectedSource {
  const containsTrack = (source: SelectedSource | null) =>
    source &&
    (source.type === "soundcloud"
      ? (remoteCollections[source.id || ""] || []).some((item) => item.id === track.id)
      : getSourceTracks({ ...library, selectedSource: source }).some(
          (item) => item.id === track.id,
        ));
  for (const source of [library.settings.session.queue.source, library.selectedSource]) {
    if (source && containsTrack(source)) {
      return {
        type: source.type,
        ...(source.id ? { id: source.id } : {}),
        ...(source.path ? { path: source.path } : {}),
      };
    }
  }
  if (track.source === "soundcloud" || track.soundcloud) {
    const id = Object.keys(remoteCollections).find((id) =>
      containsTrack({ type: "soundcloud", id }),
    );
    return id ? { type: "soundcloud", id } : { type: "library-tracks" };
  }
  const folder = library.folders.find((folder) => folder.trackIds.includes(track.id));
  return folder ? { type: "folder", id: folder.id } : { type: "library-tracks" };
}
