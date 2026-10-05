import { cleanup, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { defaultPlaybackSettings } from "../../../../shared/library";
import { usePlayerKeyboardShortcuts } from "../use-player-keyboard-shortcuts";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it.each(["MacIntel", "Win32"])(
  "reveals the playing song with the platform shortcut on %s",
  (platform) => {
    vi.spyOn(navigator, "platform", "get").mockReturnValue(platform);
    const reveal = vi.fn();
    renderHook(() =>
      usePlayerKeyboardShortcuts({
        playbackSettings: defaultPlaybackSettings(),
        onRevealPlayingTrack: reveal,
        onToggleQueue: vi.fn(),
        onOpenSearch: vi.fn(),
        onOpenSettings: vi.fn(),
        onTogglePlayback: vi.fn(),
        onSeekBy: vi.fn(),
        onChangeVolumeBy: vi.fn(),
        onSelectAdjacentTrack: vi.fn(),
        onPlaySelectedTrack: vi.fn(),
        onToggleSelectedTrackFavorite: vi.fn(),
      }),
    );
    fireEvent.keyDown(window, {
      key: "j",
      code: "KeyJ",
      metaKey: platform === "MacIntel",
      ctrlKey: platform !== "MacIntel",
    });
    expect(reveal).toHaveBeenCalledOnce();
    const input = document.createElement("input");
    document.body.append(input);
    fireEvent.keyDown(input, { key: "j", code: "KeyJ", metaKey: true, ctrlKey: true });
    expect(reveal).toHaveBeenCalledOnce();
    input.remove();
  },
);
