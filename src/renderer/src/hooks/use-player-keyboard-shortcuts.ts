import { useEffect } from "react";
import type { PlaybackSettings } from "../../../shared/library";
import { isEditableTarget } from "@/lib/dom";
import { isMacPlatform } from "@/lib/platform";

export function usePlayerKeyboardShortcuts({
  playbackSettings,
  onToggleQueue,
  onRevealPlayingTrack,
  onOpenSearch,
  onOpenSettings,
  onTogglePlayback,
  onSeekBy,
  onChangeVolumeBy,
  onSelectAdjacentTrack,
  onPlaySelectedTrack,
  onToggleSelectedTrackFavorite,
  onAddMarker,
}: {
  playbackSettings: PlaybackSettings;
  onToggleQueue: () => void;
  onRevealPlayingTrack: () => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  onTogglePlayback: () => void;
  onSeekBy: (offset: number) => void;
  onChangeVolumeBy: (offset: number) => void;
  onSelectAdjacentTrack: (direction: 1 | -1, step?: number) => void;
  onPlaySelectedTrack: () => void;
  onToggleSelectedTrackFavorite: () => void;
  onAddMarker?: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;

      if (
        (event.metaKey || event.ctrlKey) &&
        (event.key.toLowerCase() === "k" || event.key.toLowerCase() === "f")
      ) {
        event.preventDefault();
        onOpenSearch();
        return;
      }

      const primaryModifier = isMacPlatform() ? event.metaKey : event.ctrlKey;
      if (primaryModifier && event.key.toLowerCase() === "j" && !event.altKey && !event.shiftKey) {
        event.preventDefault();
        onRevealPlayingTrack();
        return;
      }
      if (primaryModifier && event.key.toLowerCase() === "l") {
        event.preventDefault();
        onToggleQueue();
        return;
      }

      if (primaryModifier && event.key === ",") {
        event.preventDefault();
        onOpenSettings();
        return;
      }

      if (event.code === "Space" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        onTogglePlayback();
        return;
      }

      if (event.code === "ArrowLeft" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        const step = playbackSettings.seekStepSeconds;
        onSeekBy(event.shiftKey ? -(step * 2) : -step);
        return;
      }

      if (event.code === "ArrowRight" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        const step = playbackSettings.seekStepSeconds;
        onSeekBy(event.shiftKey ? step * 2 : step);
        return;
      }

      if (event.code === "ArrowUp" && primaryModifier && !event.altKey) {
        event.preventDefault();
        const step = playbackSettings.volumeStepPercent / 100;
        onChangeVolumeBy(event.shiftKey ? step * 2 : step);
        return;
      }

      if (event.code === "ArrowDown" && primaryModifier && !event.altKey) {
        event.preventDefault();
        const step = playbackSettings.volumeStepPercent / 100;
        onChangeVolumeBy(event.shiftKey ? -(step * 2) : -step);
        return;
      }

      if (event.code === "ArrowUp" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        onSelectAdjacentTrack(-1, event.shiftKey ? 10 : 1);
        return;
      }

      if (event.code === "ArrowDown" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        onSelectAdjacentTrack(1, event.shiftKey ? 10 : 1);
        return;
      }

      if (event.code === "Enter" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        onPlaySelectedTrack();
        return;
      }

      if (event.key.toLowerCase() === "l" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        onToggleSelectedTrackFavorite();
        return;
      }

      if (
        onAddMarker &&
        event.key.toLowerCase() === "m" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        event.preventDefault();
        onAddMarker();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    onAddMarker,
    onChangeVolumeBy,
    onOpenSearch,
    onOpenSettings,
    onPlaySelectedTrack,
    onSeekBy,
    onSelectAdjacentTrack,
    onToggleQueue,
    onRevealPlayingTrack,
    onTogglePlayback,
    onToggleSelectedTrackFavorite,
    playbackSettings,
  ]);
}
