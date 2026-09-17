import {
  defaultEqualizerSettings,
  equalizerBandCount,
  type EqualizerPresetId,
  type EqualizerSettings,
  type QuietListeningStrength,
} from "../../../../shared/library";

export const equalizerBandFrequencies = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
export const equalizerBandLabels = ["31", "62", "125", "250", "500", "1k", "2k", "4k", "8k", "16k"];
export const equalizerGainLimitDb = 12;
export const equalizerBandQ = 1.41;

export const equalizerPresetOrder: EqualizerPresetId[] = [
  "flat",
  "quiet",
  "bass",
  "vocal",
  "custom",
];

export const equalizerPresetLabels: Record<EqualizerPresetId, string> = {
  flat: "Flat",
  quiet: "Quiet listening",
  bass: "Bass boost",
  vocal: "Vocal",
  custom: "Custom",
};

export const quietListeningStrengthOrder: QuietListeningStrength[] = ["light", "medium", "strong"];

export const quietListeningStrengthLabels: Record<QuietListeningStrength, string> = {
  light: "Light",
  medium: "Medium",
  strong: "Strong",
};

// Bass stays in place while the bands the ear is most sensitive to at low levels step back,
// following the shape of equal-loudness contours.
const quietListeningGainsDb = [0, 0, -1.5, -4, -6, -7, -8, -9, -6, -3];
const quietListeningStrengthScale: Record<QuietListeningStrength, number> = {
  light: 0.55,
  medium: 1,
  strong: 1.4,
};
const fixedPresetGainsDb: Record<"flat" | "bass" | "vocal", number[]> = {
  flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  bass: [6, 5, 4, 2, 0, 0, 0, 0, 0, 0],
  vocal: [-2, -2, -1, 1, 3, 4, 4, 2, 0, -1],
};
const presetIds = new Set<EqualizerPresetId>(equalizerPresetOrder);
const strengthIds = new Set<QuietListeningStrength>(quietListeningStrengthOrder);

function roundToHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

export function clampEqualizerGain(gainDb: number): number {
  if (!Number.isFinite(gainDb)) return 0;
  return roundToHalf(Math.min(equalizerGainLimitDb, Math.max(-equalizerGainLimitDb, gainDb)));
}

function normalizeGains(gainsDb: unknown): number[] {
  const values = Array.isArray(gainsDb) ? gainsDb : [];
  return Array.from({ length: equalizerBandCount }, (_, index) =>
    clampEqualizerGain(Number(values[index])),
  );
}

export function normalizeEqualizerSettings(value: Partial<EqualizerSettings> | undefined) {
  const defaults = defaultEqualizerSettings();
  if (!value) return defaults;

  return {
    enabled: typeof value.enabled === "boolean" ? value.enabled : defaults.enabled,
    preset: value.preset && presetIds.has(value.preset) ? value.preset : defaults.preset,
    strength:
      value.strength && strengthIds.has(value.strength) ? value.strength : defaults.strength,
    preampDb: clampEqualizerGain(Number(value.preampDb)),
    gainsDb: normalizeGains(value.gainsDb),
    customGainsDb: normalizeGains(value.customGainsDb),
  } satisfies EqualizerSettings;
}

export function getPresetGains(
  preset: EqualizerPresetId,
  strength: QuietListeningStrength,
  customGainsDb: number[],
): number[] {
  if (preset === "custom") return normalizeGains(customGainsDb);
  if (preset === "quiet") {
    return quietListeningGainsDb.map((gainDb) =>
      clampEqualizerGain(gainDb * quietListeningStrengthScale[strength]),
    );
  }
  return fixedPresetGainsDb[preset].slice();
}

export function selectEqualizerPreset(
  settings: EqualizerSettings,
  preset: EqualizerPresetId,
): EqualizerSettings {
  return {
    ...settings,
    preset,
    gainsDb: getPresetGains(preset, settings.strength, settings.customGainsDb),
  };
}

export function selectQuietListeningStrength(
  settings: EqualizerSettings,
  strength: QuietListeningStrength,
): EqualizerSettings {
  return {
    ...settings,
    preset: "quiet",
    strength,
    gainsDb: getPresetGains("quiet", strength, settings.customGainsDb),
  };
}

export function setEqualizerBandGain(
  settings: EqualizerSettings,
  bandIndex: number,
  gainDb: number,
): EqualizerSettings {
  const gainsDb = settings.gainsDb.slice();
  gainsDb[bandIndex] = clampEqualizerGain(gainDb);
  return { ...settings, preset: "custom", gainsDb, customGainsDb: gainsDb.slice() };
}

export function setEqualizerPreamp(
  settings: EqualizerSettings,
  preampDb: number,
): EqualizerSettings {
  return { ...settings, preampDb: clampEqualizerGain(preampDb) };
}

export function getActiveEqualizerGains(settings: EqualizerSettings): {
  preampDb: number;
  gainsDb: number[];
} {
  if (!settings.enabled) {
    return { preampDb: 0, gainsDb: Array.from({ length: equalizerBandCount }, () => 0) };
  }
  return { preampDb: settings.preampDb, gainsDb: settings.gainsDb };
}

function getPeakingResponseDb(
  frequency: number,
  centerFrequency: number,
  gainDb: number,
  sampleRate: number,
): number {
  if (gainDb === 0) return 0;
  const amplitude = 10 ** (gainDb / 40);
  const w0 = (2 * Math.PI * centerFrequency) / sampleRate;
  const alpha = Math.sin(w0) / (2 * equalizerBandQ);
  const cosW0 = Math.cos(w0);
  const w = (2 * Math.PI * frequency) / sampleRate;
  const magnitudeSquared = (b0: number, b1: number, b2: number) => {
    const real = b0 + b1 * Math.cos(w) + b2 * Math.cos(2 * w);
    const imaginary = -(b1 * Math.sin(w) + b2 * Math.sin(2 * w));
    return real * real + imaginary * imaginary;
  };

  return (
    10 *
    Math.log10(
      magnitudeSquared(1 + alpha * amplitude, -2 * cosW0, 1 - alpha * amplitude) /
        magnitudeSquared(1 + alpha / amplitude, -2 * cosW0, 1 - alpha / amplitude),
    )
  );
}

export function getEqualizerResponseDb(
  settings: EqualizerSettings,
  frequency: number,
  sampleRate = 48_000,
): number {
  const { preampDb, gainsDb } = getActiveEqualizerGains(settings);
  return equalizerBandFrequencies.reduce(
    (totalDb, centerFrequency, index) =>
      totalDb + getPeakingResponseDb(frequency, centerFrequency, gainsDb[index], sampleRate),
    preampDb,
  );
}
