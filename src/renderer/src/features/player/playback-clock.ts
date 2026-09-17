import { useSyncExternalStore } from "react";

type Listener = () => void;

// Holds the playhead position outside React state. The waveform reports it on every animation
// frame, but the UI only shows whole seconds, so subscribers re-render once per second.
export class PlaybackClock {
  private time = 0;
  private readonly listeners = new Set<Listener>();

  getTime = (): number => this.time;

  getWholeSeconds = (): number => Math.floor(this.time);

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  setTime(time: number): void {
    const nextTime = Number.isFinite(time) ? Math.max(0, time) : 0;
    if (nextTime === this.time) return;
    this.time = nextTime;
    this.listeners.forEach((listener) => listener());
  }
}

export function usePlaybackSeconds(clock: PlaybackClock): number {
  return useSyncExternalStore(clock.subscribe, clock.getWholeSeconds);
}
