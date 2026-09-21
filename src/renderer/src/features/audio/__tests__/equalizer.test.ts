import { describe, expect, it } from "vitest";
import { defaultEqualizerSettings } from "../../../../../shared/library";
import {
  getActiveEqualizerGains,
  getEqualizerResponseDb,
  normalizeEqualizerSettings,
  selectEqualizerPreset,
  selectQuietListeningStrength,
  setEqualizerBandGain,
  setEqualizerPreamp,
} from "../equalizer";

describe("equalizer", () => {
  it("keeps bass in place and steps mids and highs back for quiet listening", () => {
    const medium = selectEqualizerPreset(defaultEqualizerSettings(), "quiet");
    expect(medium.gainsDb).toEqual([0, 0, -1.5, -4, -6, -7, -8, -9, -6, -3]);

    expect(selectQuietListeningStrength(medium, "light").gainsDb).toEqual([
      0, 0, -1, -2, -3.5, -4, -4.5, -5, -3.5, -1.5,
    ]);
    expect(selectQuietListeningStrength(medium, "strong").gainsDb).toEqual([
      0, 0, -2, -5.5, -8.5, -10, -11, -12, -8.5, -4,
    ]);
  });

  it("switches to custom when a band changes and restores custom gains later", () => {
    const edited = setEqualizerBandGain(
      selectEqualizerPreset(defaultEqualizerSettings(), "bass"),
      9,
      4.2,
    );
    expect(edited.preset).toBe("custom");
    expect(edited.gainsDb).toEqual([6, 5, 4, 2, 0, 0, 0, 0, 0, 4]);

    const flat = selectEqualizerPreset(edited, "flat");
    expect(flat.gainsDb.every((gainDb) => gainDb === 0)).toBe(true);
    expect(selectEqualizerPreset(flat, "custom").gainsDb).toEqual(edited.gainsDb);
  });

  it("resets preset preamp while retaining the complete custom sound", () => {
    const bass = selectEqualizerPreset(defaultEqualizerSettings(), "bass");
    const custom = setEqualizerPreamp(bass, 5);
    expect(custom.preset).toBe("custom");
    const flat = selectEqualizerPreset(custom, "flat");
    expect(flat.preampDb).toBe(0);
    expect(getEqualizerResponseDb({ ...flat, enabled: true }, 1000)).toBe(0);
    const restored = selectEqualizerPreset(flat, "custom");
    expect(restored.preampDb).toBe(5);
    expect(restored.gainsDb).toEqual(bass.gainsDb);
    expect(selectQuietListeningStrength(custom, "strong").preampDb).toBe(0);
  });

  it("preserves the custom preamp from settings saved before the new field existed", () => {
    const restored = normalizeEqualizerSettings({ preset: "custom", preampDb: -4 });
    expect(selectEqualizerPreset(selectEqualizerPreset(restored, "flat"), "custom").preampDb).toBe(
      -4,
    );
  });

  it("clamps gains to the slider range", () => {
    const settings = setEqualizerPreamp(
      setEqualizerBandGain(defaultEqualizerSettings(), 0, 40),
      -30,
    );
    expect(settings.gainsDb[0]).toBe(12);
    expect(settings.preampDb).toBe(-12);
  });

  it("repairs stored settings with missing or invalid values", () => {
    const settings = normalizeEqualizerSettings({
      enabled: true,
      preset: "loud" as never,
      preampDb: Number.NaN,
      gainsDb: [3, "x" as never, 99],
    });

    expect(settings.enabled).toBe(true);
    expect(settings.preset).toBe("flat");
    expect(settings.strength).toBe("medium");
    expect(settings.preampDb).toBe(0);
    expect(settings.gainsDb).toEqual([3, 0, 12, 0, 0, 0, 0, 0, 0, 0]);
    expect(settings.customGainsDb).toHaveLength(10);
  });

  it("passes audio through untouched while disabled", () => {
    const settings = { ...selectEqualizerPreset(defaultEqualizerSettings(), "vocal"), preampDb: 3 };
    expect(getActiveEqualizerGains(settings).gainsDb.every((gainDb) => gainDb === 0)).toBe(true);
    expect(getEqualizerResponseDb(settings, 1000)).toBe(0);
    expect(
      getEqualizerResponseDb({ ...defaultEqualizerSettings(), enabled: true, preampDb: 3 }, 20),
    ).toBe(3);
  });

  it("peaks at a band's gain at its center frequency", () => {
    const settings = {
      ...setEqualizerBandGain(defaultEqualizerSettings(), 5, 6),
      enabled: true,
    };
    expect(getEqualizerResponseDb(settings, 1000)).toBeCloseTo(6, 1);
    expect(getEqualizerResponseDb(settings, 100)).toBeCloseTo(0, 0);
  });
});
