import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  defaultAppSettings,
  defaultLibrarySettings,
  emptyLibraryState,
  type AppSettings,
  type LibrarySettings,
  type LibraryState,
} from "../../shared/library";
import { electron } from "../electron";
import { materializeStoredArtwork } from "../artwork";

const { app } = electron;

function libraryPath(): string {
  return join(app.getPath("userData"), "library.json");
}

export async function readLibraryState(): Promise<LibraryState> {
  try {
    const raw = await readFile(libraryPath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<LibraryState>;
    return normalizeLibraryState(parsed);
  } catch {
    return emptyLibraryState();
  }
}

export async function writeLibraryState(state: LibraryState): Promise<LibraryState> {
  await writeFile(libraryPath(), `${JSON.stringify(state, null, 2)}\n`, "utf8");
  return state;
}

export async function normalizeLibraryState(state: Partial<LibraryState>): Promise<LibraryState> {
  const settings = normalizeSettings(state.settings);
  return materializeStoredArtwork({
    ...emptyLibraryState(),
    ...state,
    favoriteTrackIds: state.favoriteTrackIds || [],
    settings,
  });
}

export function normalizeSettings(
  settings: Partial<AppSettings> | Partial<LibrarySettings> | undefined,
): AppSettings {
  const defaults = defaultAppSettings();
  if (!settings) return defaults;

  if ("library" in settings || "playback" in settings || "session" in settings) {
    const grouped = settings as Partial<AppSettings>;
    return {
      library: { ...defaults.library, ...(grouped.library || {}) },
      playback: { ...defaults.playback, ...(grouped.playback || {}) },
      appearance: { ...defaults.appearance, ...(grouped.appearance || {}) },
      telemetry: { ...defaults.telemetry, ...(grouped.telemetry || {}) },
      lastfm: { ...defaults.lastfm, ...(grouped.lastfm || {}) },
      session: { ...defaults.session, ...(grouped.session || {}) },
    };
  }

  return {
    ...defaults,
    library: {
      ...defaultLibrarySettings(),
      ...(settings as Partial<LibrarySettings>),
    },
  };
}
