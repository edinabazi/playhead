export type LibraryMode = "folder" | "library";

export type SourceType =
  | "folder"
  | "playlist"
  | "tag"
  | "loved"
  | "library-artists"
  | "library-artist"
  | "library-albums"
  | "library-album"
  | "library-tracks";

export type LibraryFolder = {
  id: string;
  name: string;
  path: string;
  trackIds: string[];
};

export type LibraryTrack = {
  id: string;
  path: string;
  fileName: string;
  title: string;
  artist: string;
  album?: string;
  albumArtist?: string;
  trackNumber?: number;
  diskNumber?: number;
  year?: number;
  artwork?: LibraryArtwork;
  duration: number;
  audioFormat?: string;
  sampleRate?: number;
  bitRate?: number;
  bpm?: number;
  bpmSource?: "metadata" | "analysis";
  folderId: string;
};

export type EditableTrackMetadata = {
  title: string;
  artist: string;
  album: string;
  albumArtist: string;
  genre: string;
  year: string;
  trackNumber: string;
  diskNumber: string;
  composer: string;
  bpm: string;
  comment: string;
  artwork?: EditableTrackArtwork;
};

export type EditableTrackArtwork = {
  mimeType: string;
  data: ArrayBuffer;
};

export type TrackMetadata = {
  editable: EditableTrackMetadata;
  format: Record<string, string>;
  common: Record<string, string>;
  native: { id: string; value: string }[];
  canSave: boolean;
  saveUnsupportedReason?: string;
};

export type LibraryArtwork = {
  mimeType: string;
  src?: string;
  dataUrl?: string;
};

export type LibraryPlaylist = {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type LibraryTag = {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type SelectedSource = {
  type: SourceType;
  id?: string;
};

export type LibraryState = {
  folders: LibraryFolder[];
  tracks: Record<string, LibraryTrack>;
  playlists: LibraryPlaylist[];
  tags: LibraryTag[];
  favoriteTrackIds: string[];
  selectedSource: SelectedSource | null;
  settings: AppSettings;
};

export type AppSettings = {
  library: LibrarySettings;
  playback: PlaybackSettings;
  appearance: AppearanceSettings;
  telemetry: TelemetrySettings;
  lastfm: LastfmSettings;
  session: SessionSettings;
};

export type LibrarySettings = {
  mode: LibraryMode;
  enabledAudioExtensions: string[];
  watchFolders: boolean;
  rescanOnLaunch: boolean;
};

export type PlaybackSettings = {
  seekStepSeconds: number;
  volumeStepPercent: number;
  rememberTrackPositions: boolean;
  restoreLastSession: boolean;
  skipUnavailableTracks: boolean;
};

export type AppearanceSettings = {
  appTransparency: number;
  reduceMotion: boolean;
};

export type TelemetrySettings = {
  enabled: boolean;
};

export type LastfmSettings = {
  scrobblingEnabled: boolean;
  loveSyncEnabled: boolean;
};

export type SessionSettings = {
  activeTrackId: string | null;
  selectedTrackIds: string[];
  trackPositions: Record<string, number>;
  shuffleEnabled: boolean;
  repeatMode: "off" | "all" | "one";
};

export type ScannedFolder = {
  folder: LibraryFolder;
  tracks: LibraryTrack[];
};

export type MediaCommand = "play-pause" | "next" | "previous";

export type AppUpdateState =
  | { status: "idle"; version?: string }
  | { status: "checking"; version?: string }
  | { status: "downloading"; version?: string; progress?: number }
  | { status: "ready"; version?: string }
  | { status: "error"; version?: string; message: string };

export type LastfmState = {
  configured: boolean;
  connected: boolean;
  username?: string;
  pendingAuth: boolean;
  queueSize: number;
  lastError?: string;
};

export type LastfmTrackPayload = {
  artist: string;
  title: string;
  album?: string;
  albumArtist?: string;
  duration?: number;
  timestamp?: number;
};

export type WaveformCacheRequest = {
  trackId: string;
  path: string;
  duration: number;
};

export type WaveformCacheEntry = {
  duration: number;
  peaks: number[][];
};

export type WaveformCacheWrite = WaveformCacheRequest & {
  peaks: number[][];
};

export type BpmCacheRequest = {
  trackId: string;
  path: string;
};

export type BpmCacheEntry = {
  bpm: number;
  tempo: number;
  analyzedAt: string;
};

export type BpmCacheWrite = BpmCacheRequest & BpmCacheEntry;

export type PlayheadApi = {
  getAppVersion: () => Promise<string>;
  getLibraryState: () => Promise<LibraryState>;
  saveLibraryState: (state: LibraryState) => Promise<LibraryState>;
  selectMusicFolder: (extensions?: string[]) => Promise<ScannedFolder[]>;
  scanFolder: (folder: LibraryFolder, extensions?: string[]) => Promise<ScannedFolder>;
  scanFolderPath: (path: string, extensions?: string[]) => Promise<ScannedFolder>;
  getDroppedFilePath: (file: File) => string;
  getAudioFileUrl: (path: string) => Promise<string>;
  readAudioFile: (path: string) => Promise<ArrayBuffer>;
  getWaveformCache: (request: WaveformCacheRequest) => Promise<WaveformCacheEntry | null>;
  saveWaveformCache: (write: WaveformCacheWrite) => Promise<void>;
  getBpmCache: (request: BpmCacheRequest) => Promise<BpmCacheEntry | null>;
  saveBpmCache: (write: BpmCacheWrite) => Promise<void>;
  getTrackMetadata: (path: string) => Promise<TrackMetadata>;
  saveTrackMetadata: (
    path: string,
    folderId: string,
    metadata: EditableTrackMetadata,
  ) => Promise<LibraryTrack>;
  watchLibraryFolders: (folders: LibraryFolder[], extensions?: string[]) => Promise<void>;
  showItemInFolder: (path: string) => Promise<void>;
  openDataFolder: () => Promise<void>;
  clearWaveformCache: () => Promise<void>;
  exportLibraryBackup: (state: LibraryState) => Promise<boolean>;
  importLibraryBackup: () => Promise<LibraryState | null>;
  getUpdateState: () => Promise<AppUpdateState>;
  checkForUpdates: () => Promise<AppUpdateState>;
  installUpdate: () => Promise<boolean>;
  getLastfmState: () => Promise<LastfmState>;
  startLastfmAuth: () => Promise<LastfmState>;
  completeLastfmAuth: () => Promise<LastfmState>;
  disconnectLastfm: () => Promise<LastfmState>;
  updateLastfmNowPlaying: (track: LastfmTrackPayload) => Promise<LastfmState>;
  scrobbleLastfmTrack: (track: LastfmTrackPayload) => Promise<LastfmState>;
  loveLastfmTrack: (track: LastfmTrackPayload) => Promise<LastfmState>;
  unloveLastfmTrack: (track: LastfmTrackPayload) => Promise<LastfmState>;
  flushLastfmQueue: () => Promise<LastfmState>;
  minimizeWindow: () => Promise<void>;
  toggleMaximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  moveWindowTo: (x: number, y: number) => Promise<void>;
  trackEvent: (eventName: string, properties?: Record<string, string | number | boolean>) => void;
  onMediaCommand: (callback: (command: MediaCommand) => void) => () => void;
  onFolderChanged: (callback: (folderId: string) => void) => () => void;
  onUpdateStateChanged: (callback: (state: AppUpdateState) => void) => () => void;
};

export const defaultLibrarySettings = (): LibrarySettings => ({
  mode: "library",
  enabledAudioExtensions: [
    ".aac",
    ".aif",
    ".aiff",
    ".flac",
    ".m4a",
    ".mp3",
    ".ogg",
    ".opus",
    ".wav",
  ],
  watchFolders: true,
  rescanOnLaunch: false,
});

export const defaultPlaybackSettings = (): PlaybackSettings => ({
  seekStepSeconds: 5,
  volumeStepPercent: 5,
  rememberTrackPositions: true,
  restoreLastSession: true,
  skipUnavailableTracks: true,
});

export const defaultAppearanceSettings = (): AppearanceSettings => ({
  appTransparency: 95,
  reduceMotion: false,
});

export const defaultTelemetrySettings = (): TelemetrySettings => ({
  enabled: true,
});

export const defaultLastfmSettings = (): LastfmSettings => ({
  scrobblingEnabled: true,
  loveSyncEnabled: false,
});

export const defaultSessionSettings = (): SessionSettings => ({
  activeTrackId: null,
  selectedTrackIds: [],
  trackPositions: {},
  shuffleEnabled: false,
  repeatMode: "off",
});

export const defaultAppSettings = (): AppSettings => ({
  library: defaultLibrarySettings(),
  playback: defaultPlaybackSettings(),
  appearance: defaultAppearanceSettings(),
  telemetry: defaultTelemetrySettings(),
  lastfm: defaultLastfmSettings(),
  session: defaultSessionSettings(),
});

export const emptyLibraryState = (): LibraryState => ({
  folders: [],
  tracks: {},
  playlists: [],
  tags: [],
  favoriteTrackIds: [],
  selectedSource: null,
  settings: defaultAppSettings(),
});
