// Positions this close to either end aren't worth resuming from.
const POSITION_EDGE_SECONDS = 3;

export function withTrackPosition(
  positions: Record<string, number>,
  trackId: string,
  time: number,
  duration?: number,
): Record<string, number> {
  const next = { ...positions };
  const nearEnd = Boolean(duration && time >= duration - POSITION_EDGE_SECONDS);
  if (!Number.isFinite(time) || time < POSITION_EDGE_SECONDS || nearEnd) delete next[trackId];
  else next[trackId] = time;
  return next;
}

export function resumePosition(saved: number | undefined, duration?: number): number {
  if (!saved || !Number.isFinite(saved) || saved < POSITION_EDGE_SECONDS) return 0;
  if (duration && saved >= duration - POSITION_EDGE_SECONDS) return 0;
  return saved;
}
