import { expect, it } from "vitest";
import { emptyLibraryState, type LibraryTrack } from "../../../../../shared/library";
import { getPlayingTrackSource } from "../playing-track-source";

const track: LibraryTrack = {
  id: "song",
  path: "/music/album/song.mp3",
  fileName: "song.mp3",
  title: "Song",
  artist: "Artist",
  duration: 1,
  folderId: "folder",
};
function state() {
  const state = emptyLibraryState();
  state.folders = [{ id: "folder", name: "Music", path: "/music", trackIds: [track.id] }];
  state.tracks = { [track.id]: track };
  state.playlists = [
    { id: "playlist", name: "Set", trackIds: [track.id], createdAt: "", updatedAt: "" },
  ];
  return state;
}
it("returns the playback source after navigating to another view", () => {
  const library = state();
  library.settings.session.queue.source = { type: "playlist", id: "playlist", title: "Set" };
  library.selectedSource = { type: "library-artists" };
  expect(getPlayingTrackSource(library, track)).toEqual({ type: "playlist", id: "playlist" });
});
it("preserves the playing subfolder", () => {
  const library = state();
  library.settings.session.queue.source = { type: "folder", id: "folder", path: "/music/album" };
  expect(getPlayingTrackSource(library, track)).toEqual({
    type: "folder",
    id: "folder",
    path: "/music/album",
  });
});
it("falls back to the track's folder when the playback playlist no longer exists", () => {
  const library = state();
  library.settings.session.queue.source = { type: "playlist", id: "deleted" };
  expect(getPlayingTrackSource(library, track)).toEqual({ type: "folder", id: "folder" });
});
it("finds the source collection for a remote track", () => {
  const remote = { ...track, id: "remote", source: "soundcloud" as const };
  expect(getPlayingTrackSource(state(), remote, { uploads: [remote] })).toEqual({
    type: "soundcloud",
    id: "uploads",
  });
});
