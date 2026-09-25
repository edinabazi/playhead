import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { LibraryTrack } from "../../../../../shared/library";
import type { TrackLyrics } from "../../../../../shared/lyrics";
import { LyricsPanel } from "../LyricsPanel";
import { PlaybackClock } from "../../player/playback-clock";
const track = { id: "one", title: "Song", path: "/song.wav" } as LibraryTrack;
const synced: TrackLyrics = {
  source: "file",
  custom: false,
  fileName: "Song.lrc",
  lyrics: {
    synced: true,
    lines: [
      { time: 0.2, text: "First line" },
      { time: 0.6, text: "Second line" },
    ],
  },
};
let api: {
  getTrackLyrics: ReturnType<typeof vi.fn>;
  selectTrackLyrics: ReturnType<typeof vi.fn>;
  watchTrackLyrics: ReturnType<typeof vi.fn>;
  onLyricsChanged: ReturnType<typeof vi.fn>;
};
beforeEach(() => {
  api = {
    getTrackLyrics: vi.fn().mockResolvedValue(synced),
    selectTrackLyrics: vi.fn(),
    watchTrackLyrics: vi.fn().mockResolvedValue(undefined),
    onLyricsChanged: vi.fn().mockReturnValue(() => {}),
  };
  vi.stubGlobal("playhead", api);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  HTMLElement.prototype.scrollTo = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("highlights within a second, seeks without a playback toggle and yields scrolling to the user", async () => {
  const clock = new PlaybackClock();
  const seek = vi.fn();
  const view = render(
    <LyricsPanel track={track} clock={clock} reduceMotion onSeek={seek} onClose={() => {}} />,
  );
  const first = await view.findByRole("button", { name: /First line/ });
  const second = view.getByRole("button", { name: /Second line/ });
  await act(async () => clock.setTime(0.3));
  expect(first.getAttribute("aria-current")).toBe("true");
  await act(async () => clock.setTime(0.65));
  expect(second.getAttribute("aria-current")).toBe("true");
  expect(first.getAttribute("aria-current")).toBeNull();
  fireEvent.click(first);
  expect(seek).toHaveBeenCalledExactlyOnceWith(0.2);
  fireEvent.wheel(view.getByLabelText("Lyric lines"));
  fireEvent.click(view.getByRole("button", { name: "Follow playback" }));
  expect(view.queryByRole("button", { name: "Follow playback" })).toBeNull();
});
it("ignores a previous track's late response", async () => {
  let resolveOld!: (value: TrackLyrics) => void;
  api.getTrackLyrics.mockImplementation((id: string) =>
    id === "one"
      ? new Promise((resolve) => {
          resolveOld = resolve;
        })
      : Promise.resolve({
          ...synced,
          lyrics: { synced: false, lines: [{ time: null, text: "New track lyrics" }] },
        }),
  );
  const clock = new PlaybackClock();
  const view = render(
    <LyricsPanel
      key="one"
      track={track}
      clock={clock}
      reduceMotion
      onSeek={() => {}}
      onClose={() => {}}
    />,
  );
  view.rerender(
    <LyricsPanel
      key="two"
      track={{ ...track, id: "two" }}
      clock={clock}
      reduceMotion
      onSeek={() => {}}
      onClose={() => {}}
    />,
  );
  await view.findByText("New track lyrics");
  await act(async () => resolveOld(synced));
  expect(view.queryByText("First line")).toBeNull();
  expect(view.getByText("New track lyrics")).toBeTruthy();
});
it("keeps existing lyrics after an invalid file and ignores focus refresh during a file picker", async () => {
  let finish!: (value: TrackLyrics | null) => void;
  api.selectTrackLyrics.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const view = render(
    <LyricsPanel
      track={track}
      clock={new PlaybackClock()}
      reduceMotion
      onSeek={() => {}}
      onClose={() => {}}
    />,
  );
  await view.findByText("First line");
  fireEvent.click(view.getByRole("button", { name: "Lyrics options" }));
  fireEvent.click(view.getByRole("menuitem", { name: "Choose lyrics file…" }));
  fireEvent.focus(window);
  expect(api.getTrackLyrics).toHaveBeenCalledTimes(1);
  await act(async () => finish({ ...synced, fileName: "chosen.lrc" }));
  await waitFor(() => expect(view.getByText("Synced · chosen.lrc")).toBeTruthy());
  api.selectTrackLyrics.mockRejectedValue(
    new Error("This file doesn't contain any readable lyrics."),
  );
  fireEvent.click(view.getByRole("button", { name: "Lyrics options" }));
  fireEvent.click(view.getByRole("menuitem", { name: "Choose lyrics file…" }));
  await view.findByRole("alert");
  expect(view.getByText("First line")).toBeTruthy();
});
