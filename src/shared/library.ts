export type SourceType = "folder" | "playlist" | "loved";

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
  artwork?: LibraryArtwork;
  duration: number;
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
};

export type ScannedFolder = {
  folder: LibraryFolder;
  tracks: LibraryTrack[];
};

export type MediaCommand = "play-pause" | "next" | "previous";

export type PlayheadApi = {
  getLibraryState: () => Promise<LibraryState>;
  saveLibraryState: (state: LibraryState) => Promise<LibraryState>;
  selectMusicFolder: () => Promise<ScannedFolder | null>;
  scanFolder: (folder: LibraryFolder) => Promise<ScannedFolder>;
  scanFolderPath: (path: string) => Promise<ScannedFolder>;
  getDroppedFilePath: (file: File) => string;
  getAudioFileUrl: (path: string) => Promise<string>;
  readAudioFile: (path: string) => Promise<ArrayBuffer>;
  getTrackMetadata: (path: string) => Promise<TrackMetadata>;
  saveTrackMetadata: (
    path: string,
    folderId: string,
    metadata: EditableTrackMetadata,
  ) => Promise<LibraryTrack>;
  watchLibraryFolders: (folders: LibraryFolder[]) => Promise<void>;
  showItemInFolder: (path: string) => Promise<void>;
  onMediaCommand: (callback: (command: MediaCommand) => void) => () => void;
  onFolderChanged: (callback: (folderId: string) => void) => () => void;
};

export const emptyLibraryState = (): LibraryState => ({
  folders: [],
  tracks: {},
  playlists: [],
  favoriteTrackIds: [],
  selectedSource: null,
});
