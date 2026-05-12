export type LastfmPlaybackSession = {
  trackId: string;
  startedAt: number;
  maxPlayedSeconds: number;
  scrobbled: boolean;
  lastTime: number;
};

const minimumScrobbleDuration = 30;
const longTrackScrobbleSeconds = 240;

export function createLastfmPlaybackSession(
  trackId: string,
  startedAt = Date.now(),
  currentTime = 0,
): LastfmPlaybackSession {
  return {
    trackId,
    startedAt,
    maxPlayedSeconds: 0,
    scrobbled: false,
    lastTime: currentTime,
  };
}

export function updateLastfmPlaybackProgress(
  session: LastfmPlaybackSession,
  currentTime: number,
): LastfmPlaybackSession {
  const forwardDelta = currentTime >= session.lastTime ? currentTime - session.lastTime : 0;
  return {
    ...session,
    lastTime: currentTime,
    maxPlayedSeconds: session.maxPlayedSeconds + forwardDelta,
  };
}

export function shouldScrobbleLastfmTrack(
  session: LastfmPlaybackSession | null,
  duration: number,
): boolean {
  if (!session || session.scrobbled) return false;
  if (!Number.isFinite(duration) || duration < minimumScrobbleDuration) return false;

  const threshold = Math.min(duration / 2, longTrackScrobbleSeconds);
  return session.maxPlayedSeconds >= threshold;
}
