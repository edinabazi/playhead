import { useState } from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TrackList } from "../TrackList";
import { defaultTrackListSettings } from "../../../../../shared/track-list";
import type { LibraryTrack } from "../../../../../shared/library";

const tracks: LibraryTrack[] = Array.from({ length: 10000 }, (_, index) => ({
  id: String(index),
  path: `/music/${index}.mp3`,
  fileName: `${index}.mp3`,
  title: `Track ${index}`,
  artist: "Artist",
  duration: 1,
  folderId: "folder",
}));
const callbacks = {
  onSettingsChange: vi.fn(),
  onSelectTrack: vi.fn(),
  onPlayTrack: vi.fn(),
  onAddToPlaylist: vi.fn(),
  onAddTracksToPlaylist: vi.fn(),
  onCreatePlaylist: vi.fn(),
  onAddTracksToTag: vi.fn(),
  onCreateTag: vi.fn(),
  onToggleFavorite: vi.fn(),
  onRemoveFromPlaylist: vi.fn(),
  onRemoveFromTag: vi.fn(),
  onShowInFolder: vi.fn(),
  onShowMetadata: vi.fn(),
  onReorderTrack: vi.fn(),
};
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(224);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function Harness({
  index = 0,
  align = "nearest",
  focus = false,
}: {
  index?: number;
  align?: "center" | "nearest";
  focus?: boolean;
}) {
  const [request, setRequest] = useState<string | null>(String(index));
  return (
    <TrackList
      {...callbacks}
      tracks={tracks}
      settings={defaultTrackListSettings()}
      activeTrackId={null}
      isPlaying={false}
      selectedTrackIds={[String(index)]}
      scrollKey="folder"
      initialScrollTop={0}
      scrollToTrackId={request}
      scrollToTrackAlign={align}
      focusScrolledTrack={focus}
      selectedPlaylist={null}
      selectedTag={null}
      playlists={[]}
      tags={[]}
      favoriteTrackIds={[]}
      onScrollPositionChange={vi.fn()}
      onScrolledToTrack={() => setRequest(null)}
    />
  );
}

it("scrolls only one row past the lower viewport edge and does not restore the previous position", () => {
  const view = render(<Harness index={4} />);
  expect(view.getByRole("rowgroup").scrollTop).toBe(56);
});

it("keeps visible rows still and moves one row when navigating above the viewport", () => {
  const list = (id: string | null) => (
    <TrackList
      {...callbacks}
      tracks={tracks}
      settings={defaultTrackListSettings()}
      activeTrackId={null}
      isPlaying={false}
      selectedTrackIds={id ? [id] : []}
      scrollKey="folder"
      initialScrollTop={0}
      scrollToTrackId={id}
      scrollToTrackAlign="nearest"
      selectedPlaylist={null}
      selectedTag={null}
      playlists={[]}
      tags={[]}
      favoriteTrackIds={[]}
      onScrollPositionChange={vi.fn()}
      onScrolledToTrack={vi.fn()}
    />
  );
  const view = render(list(null));
  const scroller = view.getByRole("rowgroup");
  fireEvent.scroll(scroller, { target: { scrollTop: 112 } });
  view.rerender(list("3"));
  expect(scroller.scrollTop).toBe(112);
  view.rerender(list("1"));
  expect(view.getByRole("rowgroup").scrollTop).toBe(56);
});

it("reveals a distant virtualized track, keeps it selected, and focuses the list", () => {
  const view = render(<Harness index={9000} align="center" focus />);
  const scroller = view.getByRole("rowgroup");
  expect(scroller.scrollTop).toBe(9000 * 56 - 84);
  expect(document.activeElement).toBe(scroller);
  expect(view.getByText("Track 9000").closest('[role="row"]')?.getAttribute("aria-selected")).toBe(
    "true",
  );
  expect(view.queryByText("Track 0")).toBeNull();
  expect(view.getAllByRole("row").length).toBeLessThan(30);
});
