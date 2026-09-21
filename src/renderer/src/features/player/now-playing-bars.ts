const cycleSeconds = 2.18;
const tickMs = 100;
const restingTimeSeconds = 0.6;
const keyframes = [
  { at: 0, scale: 0.5, opacity: 0.55 },
  { at: 0.17, scale: 0.78, opacity: 0.78 },
  { at: 0.31, scale: 0.43, opacity: 0.58 },
  { at: 0.48, scale: 1, opacity: 1 },
  { at: 0.66, scale: 0.62, opacity: 0.7 },
  { at: 0.82, scale: 0.88, opacity: 0.86 },
  { at: 1, scale: 0.5, opacity: 0.55 },
];

export type BarPose = { scale: number; opacity: number };
type TickListener = (timeSeconds: number | null) => void;

function easeInOut(progress: number): number {
  return progress * progress * (3 - 2 * progress);
}

export function sampleNowPlayingBar(timeSeconds: number, delaySeconds: number): BarPose {
  const elapsed = Math.max(0, timeSeconds - delaySeconds);
  const phase = (elapsed % cycleSeconds) / cycleSeconds;
  const nextIndex = keyframes.findIndex((keyframe) => keyframe.at > phase);
  const next = keyframes[nextIndex === -1 ? keyframes.length - 1 : nextIndex];
  const previous = keyframes[Math.max(0, (nextIndex === -1 ? keyframes.length : nextIndex) - 1)];
  const span = next.at - previous.at;
  const progress = span > 0 ? easeInOut((phase - previous.at) / span) : 0;
  return {
    scale: previous.scale + (next.scale - previous.scale) * progress,
    opacity: previous.opacity + (next.opacity - previous.opacity) * progress,
  };
}

export function getRestingBarPose(delaySeconds: number): BarPose {
  return sampleNowPlayingBar(restingTimeSeconds + delaySeconds, delaySeconds);
}

// A continuous CSS animation makes Chromium restyle the page on every frame. The indicator only
// needs a few poses per second, and none while the window is in the background.
const listeners = new Set<TickListener>();
let interval: number | null = null;
let removeWindowListeners: (() => void) | null = null;

function isWindowActive(): boolean {
  return document.visibilityState === "visible" && document.hasFocus();
}

function notify(timeSeconds: number | null) {
  listeners.forEach((listener) => listener(timeSeconds));
}

function syncTicker() {
  const shouldRun = listeners.size > 0 && isWindowActive();
  if (shouldRun && interval === null) {
    interval = window.setInterval(() => notify(performance.now() / 1000), tickMs);
    notify(performance.now() / 1000);
  } else if (!shouldRun && interval !== null) {
    window.clearInterval(interval);
    interval = null;
    notify(null);
  }
}

export function subscribeToNowPlayingTicks(listener: TickListener): () => void {
  listeners.add(listener);
  if (!removeWindowListeners) {
    window.addEventListener("focus", syncTicker);
    window.addEventListener("blur", syncTicker);
    document.addEventListener("visibilitychange", syncTicker);
    removeWindowListeners = () => {
      window.removeEventListener("focus", syncTicker);
      window.removeEventListener("blur", syncTicker);
      document.removeEventListener("visibilitychange", syncTicker);
    };
  }
  listener(interval === null ? null : performance.now() / 1000);
  syncTicker();

  return () => {
    listeners.delete(listener);
    syncTicker();
    if (listeners.size === 0 && removeWindowListeners) {
      removeWindowListeners();
      removeWindowListeners = null;
    }
  };
}
