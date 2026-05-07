import type { LibraryState } from "../../../../shared/library";

export function normalizeSourceForMode(state: LibraryState): LibraryState {
  const source = state.selectedSource;
  if (state.settings.library.mode === "library") {
    if (!source || source.type === "folder") {
      return { ...state, selectedSource: { type: "library-tracks" } };
    }
    return state;
  }

  if (
    source?.type === "library-artists" ||
    source?.type === "library-artist" ||
    source?.type === "library-albums" ||
    source?.type === "library-album" ||
    source?.type === "library-tracks"
  ) {
    return {
      ...state,
      selectedSource: state.folders[0] ? { type: "folder", id: state.folders[0].id } : null,
    };
  }

  return state;
}
