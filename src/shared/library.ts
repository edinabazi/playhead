export type LibraryMode = "folder" | "library";

export type SourceType =
  | "folder"
  | "playlist"
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
  bpm?: number;
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

export type SelectedSource = {
  type: SourceType;
  id?: string;
};

export type LibraryState = {
  folders: LibraryFolder[];
  tracks: Record<string, LibraryTrack>;
  playlists: LibraryPlaylist[];
  favoriteTrackIds: string[];
  selectedSource: SelectedSource | null;
  settings: AppSettings;
};

export type AppSettings = {
  library: LibrarySettings;
  playback: PlaybackSettings;
  appearance: AppearanceSettings;
  telemetry: TelemetrySettings;
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

export type PlayheadApi = {
  getLibraryState: () => Promise<LibraryState>;
  saveLibraryState: (state: LibraryState) => Promise<LibraryState>;
  selectMusicFolder: (extensions?: string[]) => Promise<ScannedFolder | null>;
  scanFolder: (folder: LibraryFolder, extensions?: string[]) => Promise<ScannedFolder>;
  scanFolderPath: (path: string, extensions?: string[]) => Promise<ScannedFolder>;
  getDroppedFilePath: (file: File) => string;
  getAudioFileUrl: (path: string) => Promise<string>;
  readAudioFile: (path: string) => Promise<ArrayBuffer>;
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
  session: defaultSessionSettings(),
});

export const emptyLibraryState = (): LibraryState => ({
  folders: [],
  tracks: {},
  playlists: [],
  favoriteTrackIds: [],
  selectedSource: null,
  settings: defaultAppSettings(),
});
