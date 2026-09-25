import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { LibraryBrowser } from "../LibraryBrowser";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("renders a bounded window of a large album collection and activates albums after scrolling", () => {
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(300);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  const albums = Array.from({ length: 10000 }, (_, index) => ({
    id: String(index),
    title: `Album ${index}`,
    artist: "Artist",
    trackIds: [`track-${index}`],
  }));
  const activate = vi.fn();
  const view = render(
    <LibraryBrowser
      emptyLabel="No albums"
      albums={albums}
      scrollKey="albums"
      playlists={[]}
      onActivateAlbum={activate}
      onAddTrackIdsToPlaylist={vi.fn()}
      onScrollPositionChange={vi.fn()}
    />,
  );
  expect(view.getAllByRole("button").length).toBeLessThan(30);
  const scroller = view.container.querySelector(".overflow-y-auto")!;
  fireEvent.scroll(scroller, { target: { scrollTop: 9994 * 56 } });
  fireEvent.doubleClick(view.getByText("Album 9999"));
  expect(activate).toHaveBeenCalledExactlyOnceWith(albums[9999]);
  expect(view.queryByText("Album 0")).toBeNull();
  expect(view.getAllByRole("button").length).toBeLessThan(30);
});
