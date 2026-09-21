import type { LevelMeterSettings } from "../../../../shared/library";

export const meterFloorDb = -60;
export const meterRangeDb = 40;
const releaseDbPerSecond = 26;
const peakHoldSeconds = 1.2;
const peakHoldFallDbPerSecond = 20;

export type MeterChannelState = {
  levelDb: number;
  holdDb: number;
  holdAt: number;
};

export function normalizeLevelMeterSettings(
  value: Partial<LevelMeterSettings> | undefined,
): LevelMeterSettings {
  return { open: value?.open === true };
}

export function toDb(linear: number): number {
  if (!Number.isFinite(linear) || linear <= 0) return meterFloorDb;
  return Math.max(meterFloorDb, 20 * Math.log10(linear));
}

export function createMeterChannelState(now = 0): MeterChannelState {
  return { levelDb: meterFloorDb, holdDb: meterFloorDb, holdAt: now };
}

export function stepMeterChannel(
  state: MeterChannelState,
  peak: number | null,
  now: number,
  deltaSeconds: number,
): MeterChannelState {
  const dt = Math.min(0.1, Math.max(0, deltaSeconds));
  const peakDb = peak === null ? meterFloorDb : toDb(peak);
  const levelDb = Math.max(peakDb, state.levelDb - releaseDbPerSecond * dt, meterFloorDb);

  if (levelDb >= state.holdDb) return { levelDb, holdDb: levelDb, holdAt: now };
  if (now - state.holdAt <= peakHoldSeconds) return { ...state, levelDb };
  return {
    levelDb,
    holdDb: Math.max(meterFloorDb, state.holdDb - peakHoldFallDbPerSecond * dt),
    holdAt: state.holdAt,
  };
}

export function isMeterChannelAtRest(state: MeterChannelState): boolean {
  return state.levelDb <= -meterRangeDb && state.holdDb <= -meterRangeDb + 1;
}

export function getLitSegmentCount(levelDb: number, segmentCount: number): number {
  const segments = Math.floor(((levelDb + meterRangeDb) / meterRangeDb) * segmentCount + 0.5);
  return Math.min(segmentCount, Math.max(0, segments));
}

export function getHoldSegmentIndex(holdDb: number, segmentCount: number): number | null {
  if (holdDb <= -meterRangeDb + 1) return null;
  const index = Math.floor(((holdDb + meterRangeDb) / meterRangeDb) * segmentCount) - 1;
  return Math.min(segmentCount - 1, Math.max(0, index));
}
