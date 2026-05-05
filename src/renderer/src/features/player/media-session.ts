export function setMediaActionHandler(
  action: MediaSessionAction,
  handler: MediaSessionActionHandler | null,
) {
  try {
    navigator.mediaSession.setActionHandler(action, handler);
  } catch {
    // Some Chromium builds expose only part of the Media Session action surface.
  }
}

export function updateMediaPosition(duration: number, position: number) {
  if (!("mediaSession" in navigator) || !duration || !Number.isFinite(duration)) return;

  try {
    navigator.mediaSession.setPositionState({
      duration,
      playbackRate: 1,
      position: Math.min(duration, Math.max(0, position)),
    });
  } catch {
    // Ignore invalid transient states while audio metadata is settling.
  }
}

export function seekAudio(audio: HTMLAudioElement, seekTime: number) {
  const duration = audio.duration;
  const nextTime = Number.isFinite(duration)
    ? Math.min(duration, Math.max(0, seekTime))
    : Math.max(0, seekTime);

  const fastSeek = audio.fastSeek;
  if (typeof fastSeek === "function") fastSeek.call(audio, nextTime);
  else audio.currentTime = nextTime;

  updateMediaPosition(duration, nextTime);
  return nextTime;
}
