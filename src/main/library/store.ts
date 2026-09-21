import { appendFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  defaultAppSettings,
  defaultLibrarySettings,
  emptyLibraryState,
  type AppSettings,
  type LibrarySettings,
  type LibraryState,
  type SelectedSource,
  type SessionSettings,
} from "../../shared/library";
import { electron } from "../electron";
import { materializeStoredArtwork } from "../artwork";

const { app } = electron;
let operationQueue: Promise<void> = Promise.resolve();
let cachedLibraryState: LibraryState | null = null;
let cachedLibraryFilePath = "";

type LibraryRuntimeState = {
  selectedSource: SelectedSource | null;
  session: SessionSettings;
};

type TrackAnalysisJournalEntry = {
  trackId: string;
  bpm: number;
};

function libraryPath(): string {
  return join(app.getPath("userData"), "library.json");
}

function libraryBackupPath(): string {
  return `${libraryPath()}.bak`;
}

function libraryRuntimePath(): string {
  return join(app.getPath("userData"), "library-runtime.json");
}

function trackAnalysisJournalPath(): string {
  return join(app.getPath("userData"), "track-analysis.jsonl");
}

export async function readLibraryState(): Promise<LibraryState> {
  await operationQueue.catch(() => undefined);
  return loadLibraryState();
}

async function loadLibraryState(): Promise<LibraryState> {
  const filePath = libraryPath();
  if (cachedLibraryState && cachedLibraryFilePath === filePath) return cachedLibraryState;

  const state = await readStoredLibraryState();
  const [runtimeState, analysisEntries] = await Promise.all([
    readLibraryRuntimeState(),
    readTrackAnalysisJournal(),
  ]);
  const withRuntime = runtimeState
    ? {
        ...state,
        selectedSource: runtimeState.selectedSource,
        settings: { ...state.settings, session: runtimeState.session },
      }
    : state;
  if (
    !withRuntime.settings.library.showSubfolders &&
    withRuntime.selectedSource?.type === "folder"
  ) {
    withRuntime.selectedSource = { type: "folder", id: withRuntime.selectedSource.id };
  }
  cachedLibraryState = applyTrackAnalysisJournal(withRuntime, analysisEntries);
  cachedLibraryFilePath = filePath;
  return cachedLibraryState;
}

async function readStoredLibraryState(): Promise<LibraryState> {
  try {
    const raw = await readFile(libraryPath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<LibraryState>;
    const normalized = await normalizeLibraryState(parsed);
    if (raw.includes('"dataUrl"')) {
      await writeLibraryRuntimeState(normalized);
      await writeLibraryStateFile(normalized);
    }
    return normalized;
  } catch {
    try {
      const raw = await readFile(libraryBackupPath(), "utf8");
      return normalizeLibraryState(JSON.parse(raw) as Partial<LibraryState>);
    } catch {
      return emptyLibraryState();
    }
  }
}

export async function writeLibraryState(state: LibraryState): Promise<LibraryState> {
  return enqueueOperation(async () => {
    const current = await loadLibraryState();
    const nextState = preserveAnalyzedTrackState(stripEmbeddedArtwork(state), current);
    await writeLibraryRuntimeState(nextState);
    await writeLibraryStateFile(nextState);
    await rm(trackAnalysisJournalPath(), { force: true });
    cacheLibraryState(nextState);
    return nextState;
  });
}

export async function writeLibrarySessionSettings(session: SessionSettings): Promise<LibraryState> {
  return enqueueOperation(async () => {
    const current = await loadLibraryState();
    const nextState = {
      ...current,
      settings: { ...current.settings, session },
    };
    await writeLibraryRuntimeState(nextState);
    cacheLibraryState(nextState);
    return nextState;
  });
}

export async function writeLibraryTrackAnalysis(
  trackId: string,
  bpm: number,
): Promise<LibraryState> {
  return enqueueOperation(async () => {
    const current = await loadLibraryState();
    const track = current.tracks[trackId];
    if (!track) return current;

    const nextState = {
      ...current,
      tracks: {
        ...current.tracks,
        [trackId]: {
          ...track,
          bpm,
          bpmSource: "analysis" as const,
        },
      },
    };
    await appendTrackAnalysis({ trackId, bpm });
    cacheLibraryState(nextState);
    return nextState;
  });
}

export async function writeLibrarySelectedSource(
  selectedSource: SelectedSource | null,
): Promise<LibraryState> {
  return enqueueOperation(async () => {
    const current = await loadLibraryState();
    const nextState = { ...current, selectedSource };
    await writeLibraryRuntimeState(nextState);
    cacheLibraryState(nextState);
    return nextState;
  });
}

function enqueueOperation<T>(operation: () => Promise<T>): Promise<T> {
  const result = operationQueue.then(operation, operation);
  operationQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function cacheLibraryState(state: LibraryState): void {
  cachedLibraryState = state;
  cachedLibraryFilePath = libraryPath();
}

export function resetLibraryStoreCache(): void {
  cachedLibraryState = null;
  cachedLibraryFilePath = "";
}

async function writeLibraryStateFile(state: LibraryState): Promise<void> {
  const filePath = libraryPath();
  const backupPath = libraryBackupPath();
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  const content = `${JSON.stringify(state)}\n`;

  await mkdir(dirname(filePath), { recursive: true });
  await writeBackupIfPrimaryIsValid(filePath, backupPath);

  try {
    await writeFile(tempPath, content, "utf8");
    await rename(tempPath, filePath);
  } catch (error) {
    await rm(tempPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

async function writeLibraryRuntimeState(state: LibraryState): Promise<void> {
  const filePath = libraryRuntimePath();
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  const runtime: LibraryRuntimeState = {
    selectedSource: state.selectedSource,
    session: state.settings.session,
  };

  await mkdir(dirname(filePath), { recursive: true });
  try {
    await writeFile(tempPath, `${JSON.stringify(runtime)}\n`, "utf8");
    await rename(tempPath, filePath);
  } catch (error) {
    await rm(tempPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

async function readLibraryRuntimeState(): Promise<LibraryRuntimeState | null> {
  try {
    const parsed = JSON.parse(await readFile(libraryRuntimePath(), "utf8")) as LibraryRuntimeState;
    if (!parsed || typeof parsed !== "object" || !parsed.session) return null;
    const settings = normalizeSettings({ session: parsed.session });
    return {
      selectedSource: parsed.selectedSource || null,
      session: settings.session,
    };
  } catch {
    return null;
  }
}

async function appendTrackAnalysis(entry: TrackAnalysisJournalEntry): Promise<void> {
  const filePath = trackAnalysisJournalPath();
  await mkdir(dirname(filePath), { recursive: true });
  await appendFile(filePath, `${JSON.stringify(entry)}\n`, "utf8");
}

async function readTrackAnalysisJournal(): Promise<TrackAnalysisJournalEntry[]> {
  try {
    return (await readFile(trackAnalysisJournalPath(), "utf8"))
      .split("\n")
      .filter(Boolean)
      .flatMap((line) => {
        try {
          const entry = JSON.parse(line) as TrackAnalysisJournalEntry;
          return entry.trackId && Number.isFinite(entry.bpm) && entry.bpm > 0 ? [entry] : [];
        } catch {
          return [];
        }
      });
  } catch {
    return [];
  }
}

function applyTrackAnalysisJournal(
  state: LibraryState,
  entries: TrackAnalysisJournalEntry[],
): LibraryState {
  if (entries.length === 0) return state;

  let tracks = state.tracks;
  for (const entry of entries) {
    const track = tracks[entry.trackId];
    if (!track) continue;
    if (tracks === state.tracks) tracks = { ...state.tracks };
    tracks[entry.trackId] = { ...track, bpm: entry.bpm, bpmSource: "analysis" };
  }
  return tracks === state.tracks ? state : { ...state, tracks };
}

function preserveAnalyzedTrackState(state: LibraryState, current: LibraryState): LibraryState {
  let tracks = state.tracks;

  for (const [trackId, track] of Object.entries(state.tracks)) {
    const currentTrack = current.tracks[trackId];
    if (track.bpm || !currentTrack?.bpm || currentTrack.bpmSource !== "analysis") continue;
    if (tracks === state.tracks) tracks = { ...state.tracks };
    tracks[trackId] = { ...track, bpm: currentTrack.bpm, bpmSource: "analysis" };
  }

  return tracks === state.tracks ? state : { ...state, tracks };
}

async function writeBackupIfPrimaryIsValid(filePath: string, backupPath: string): Promise<void> {
  try {
    const raw = await readFile(filePath, "utf8");
    JSON.parse(raw);
    await writeFile(backupPath, raw, "utf8");
  } catch (error) {
    if (isMissingFileError(error) || error instanceof SyntaxError) return;
    throw error;
  }
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  );
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
      soundcloud: { ...defaults.soundcloud, ...(grouped.soundcloud || {}) },
      session: {
        ...defaults.session,
        ...(grouped.session || {}),
        sidebarGroupOrder: grouped.session?.sidebarGroupOrder || defaults.session.sidebarGroupOrder,
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
