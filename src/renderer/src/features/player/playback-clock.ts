import { useSyncExternalStore } from "react";

type Listener = () => void;

// Holds the playhead position outside React state. The waveform reports it on every animation
// frame. Elapsed-time labels subscribe by second; lyrics use precise updates with a line-index snapshot.
export class PlaybackClock {
  private time = 0;
  private readonly preciseListeners = new Set<Listener>();

  subscribePrecise = (listener: Listener): (() => void) => {
    this.preciseListeners.add(listener);
    return () => {
      this.preciseListeners.delete(listener);
    };
  };

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
    const previousSecond = this.getWholeSeconds();
    this.time = nextTime;
    this.preciseListeners.forEach((listener) => listener());
    if (this.getWholeSeconds() === previousSecond) return;
    this.listeners.forEach((listener) => listener());
  }
}

export function usePlaybackSeconds(clock: PlaybackClock): number {
  return useSyncExternalStore(clock.subscribe, clock.getWholeSeconds);
}
