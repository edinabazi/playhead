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
    const normalized = await normalizeLibraryState(parsed);
    if (raw.includes('"dataUrl"')) await writeLibraryState(normalized);
    return normalized;
  } catch {
    return emptyLibraryState();
  }
}

export async function writeLibraryState(state: LibraryState): Promise<LibraryState> {
  const nextState = stripEmbeddedArtwork(state);
  await writeFile(libraryPath(), `${JSON.stringify(nextState)}\n`, "utf8");
  return nextState;
}

export async function normalizeLibraryState(state: Partial<LibraryState>): Promise<LibraryState> {
  const settings = normalizeSettings(state.settings);
  return materializeStoredArtwork({
    ...emptyLibraryState(),
    ...state,
    tags: state.tags || [],
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
      session: {
        ...defaults.session,
        ...(grouped.session || {}),
        queue: {
          ...defaults.session.queue,
          ...(grouped.session?.queue || {}),
          items: grouped.session?.queue?.items || [],
          shuffledItems: grouped.session?.queue?.shuffledItems || [],
          activeItemId: grouped.session?.queue?.activeItemId || null,
          source: grouped.session?.queue?.source || null,
          panelOpen: grouped.session?.queue?.panelOpen || false,
        },
      },
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

function stripEmbeddedArtwork(state: LibraryState): LibraryState {
  let changed = false;
  const tracks: LibraryState["tracks"] = {};

  for (const [trackId, track] of Object.entries(state.tracks)) {
    if (!track.artwork?.dataUrl) {
      tracks[trackId] = track;
      continue;
    }

    changed = true;
    tracks[trackId] = {
      ...track,
      artwork: track.artwork.src
        ? { mimeType: track.artwork.mimeType, src: track.artwork.src }
        : undefined,
    };
  }

  return changed ? { ...state, tracks } : state;
}
