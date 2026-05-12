import { describe, expect, it } from "vitest";
import { defaultAppSettings, defaultPlaybackSettings } from "../../../shared/library";
import { normalizeSettings } from "../store";

describe("library store settings", () => {
  it("provides playback defaults", () => {
    expect(defaultPlaybackSettings()).toEqual({
      seekStepSeconds: 5,
      volumeStepPercent: 5,
      rememberTrackPositions: true,
      restoreLastSession: true,
      skipUnavailableTracks: true,
    });
  });

  it("normalizes missing settings", () => {
    expect(normalizeSettings(undefined)).toEqual(defaultAppSettings());
  });

  it("normalizes missing session playback controls", () => {
    const legacySettings = {
      session: {
        activeTrackId: "track-1",
        selectedTrackIds: ["track-1"],
        trackPositions: {},
      },
    } as unknown as Parameters<typeof normalizeSettings>[0];

    expect(normalizeSettings(legacySettings).session).toEqual({
      activeTrackId: "track-1",
      selectedTrackIds: ["track-1"],
      trackPositions: {},
      shuffleEnabled: false,
      repeatMode: "off",
    });
  });

  it("normalizes missing Last.fm settings", () => {
    const settings = normalizeSettings({
      playback: {
        seekStepSeconds: 10,
      },
    } as unknown as Parameters<typeof normalizeSettings>[0]);

    expect(settings.lastfm).toEqual({
      scrobblingEnabled: true,
      loveSyncEnabled: false,
    });
  });

  it("normalizes legacy flat library settings", () => {
    const settings = normalizeSettings({
      enabledAudioExtensions: [".mp3"],
      watchFolders: false,
      rescanOnLaunch: true,
    });

    expect(settings.library).toEqual({
      mode: "library",
      enabledAudioExtensions: [".mp3"],
      watchFolders: false,
      rescanOnLaunch: true,
    });
    expect(settings.playback).toEqual(defaultPlaybackSettings());
  });
});
