import { LibraryScanStatus } from "@/features/library/LibraryScanStatus";
import { useLibraryScan } from "@/features/library/use-library-scan";
import { playbackFailure, type PlaybackFailure } from "../../shared/playback";
import {
  loadLocalPlayback,
  PlaybackLoadError,
  waitForPlayback,
} from "@/features/player/local-playback";
import { LyricsPanel } from "@/features/lyrics/LyricsPanel";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, MotionConfig } from "framer-motion";
import Hls from "hls.js";
import WaveSurfer, { type WaveSurferOptions } from "wavesurfer.js";
import {
  type AppearanceSettings,
  type AppUpdateState,
  type EditableTrackMetadata,
  type LastfmSettings,
  type LastfmState,
  type LastfmTrackPayload,
  type LibraryFolder,
  type LibrarySettings,
  type EqualizerSettings,
  type LibraryMode,
  type LibraryPlaylist,
  type LibraryState,
  type LibraryTag,
  type LibraryTrack,
  type PlaybackSettings,
  type PlaylistExportFormat,
  type PlaylistImportTrack,
  type SoundCloudCollection,
  type SoundCloudPlaylistEdit,
  type PlaybackQueue,
  type SoundCloudSettings,
  type SoundCloudState,
  type TelemetrySettings,
  libraryTrackMetadataVersion,
  defaultSessionSettings,
  defaultSoundCloudSettings,
} from "../../shared/library";
import { getMediaArtworkSrc } from "@/lib/artwork";
import { isEditableTarget } from "@/lib/dom";
import { moveItem, moveItemsBeforeOrAfter } from "@/lib/list";
import { MetadataDialog, type MetadataDialogState } from "@/features/metadata/MetadataDialog";
import { Player } from "@/features/player/Player";
import { QueueSidebar } from "@/features/player/QueueSidebar";
import { usePlaybackQueue } from "@/features/player/use-playback-queue";
import {
  buildQueueFromTracks,
  getActiveQueueIndex,
  getVisibleQueueItems,
  addTracksToQueue,
  setQueueActiveTrack,
  smartShuffleQueue,
} from "@/features/player/queue-model";
import {
  createLastfmPlaybackSession,
  shouldScrobbleLastfmTrack,
  updateLastfmPlaybackProgress,
  type LastfmPlaybackSession,
} from "@/features/player/lastfm-scrobble";
import { CreatePlaylistDialog } from "@/features/playlists/CreatePlaylistDialog";
import { setMediaActionHandler, updateMediaPosition } from "@/features/player/media-session";
import { PlaybackClock } from "@/features/player/playback-clock";
import { limitWaveformProgressRendering } from "@/features/waveform/waveform";
import type { RepeatMode } from "@/features/player/types";
import { TrackSearchDialog, type SearchSelectContext } from "@/features/search/TrackSearchDialog";
import { SettingsDialog, type AdvancedSettingsAction } from "@/features/settings/SettingsDialog";
import { DeletePlaylistDialog } from "@/features/sidebar/DeletePlaylistDialog";
import { DeleteTagDialog } from "@/features/sidebar/DeleteTagDialog";
import { RemoveFolderDialog } from "@/features/sidebar/RemoveFolderDialog";
import { Sidebar } from "@/features/sidebar/Sidebar";
import { TrackList } from "@/features/tracks/TrackList";
import { sortTrackList } from "@/features/tracks/track-columns";
import { normalizeTrackListSettings } from "../../shared/track-list";
import { RemoveTracksFromPlaylistDialog } from "@/features/tracks/RemoveTracksFromPlaylistDialog";
import { resumePosition, withTrackPosition } from "@/features/player/track-positions";
import { applySoundCloudPlaylistEdit } from "../../shared/soundcloud-playlist";
import { UpdateMessageDialog, type UpdateMessage } from "@/features/updates/UpdateMessageDialog";
import { updateMessagesByVersion } from "@/features/updates/update-messages";
import {
  showFolderActionToast,
  showSimpleActionToast,
  showTrackActionToast,
} from "@/features/toasts/action-toasts";
import {
  analyzeBpmFromBuffer,
  buildWaveformCachePeaks,
  decodeAudioBytes,
  decodeAudioTrack,
  shouldAnalyzeTrackBpm,
  volumeNormalizationBoostedMaxGainDb,
  waveformAnalysisMaxPeaks,
  waveformAnalysisPeakRate,
} from "@/features/audio/audio-analysis";
import { PlaybackAudioEngine, type ChannelLevels } from "@/features/audio/audio-engine";
import { getActiveEqualizerGains, normalizeEqualizerSettings } from "@/features/audio/equalizer";
import { LevelsPanel } from "@/features/levels/LevelsPanel";
import { normalizeLevelMeterSettings } from "@/features/levels/meter-model";
import { boostedMaxVolume, PlaybackVolumeController } from "@/features/audio/playback-volume";
import { useLimiterActivity } from "@/features/audio/use-limiter-activity";
import {
  analyzeTrackNormalizationGain,
  getCachedTrackNormalizationGain,
} from "@/features/audio/volume-normalization";
import {
  emptyLibraryState,
  createPlaylist,
  getLibraryCollectionsFromTracks,
  getSourceTracksFromParts,
  getTrackAlbumId,
  getTrackArtistId,
  mergeScannedFolder,
  mergeScannedLibraryState,
} from "@/features/library/library-model";
import { getPathName } from "@/features/library/folder-tree";
import { useLibraryActions } from "@/features/library/use-library-actions";
import { EmptyLibraryState } from "@/features/library/EmptyLibraryState";
import { LibraryDetailHeader } from "@/features/library/LibraryDetailHeader";
import { LibraryBrowser } from "@/features/library/LibraryBrowser";
import { normalizeSourceForMode } from "@/features/library/source";
import { getPlayingTrackSource } from "@/features/library/playing-track-source";
import { usePlayerKeyboardShortcuts } from "@/hooks/use-player-keyboard-shortcuts";
import { useWindowDrag } from "@/hooks/use-window-drag";
import type { MenuAnchorPoint } from "@/lib/menu-position";
import { TrackRowMenu } from "@/features/tracks/TrackRowMenu";

const waveformCachePeakRate = waveformAnalysisPeakRate;
const waveformCacheMaxPeaks = waveformAnalysisMaxPeaks;
const sidebarWidth = 260;
const playlistExportFormatLabels: Record<PlaylistExportFormat, string> = {
  m3u: "M3U",
  m3u8: "M3U8",
  playhead: "Playhead JSON",
  rekordbox: "rekordbox XML",
  traktor: "Traktor NML",
};
type WaveformPeaks = NonNullable<WaveSurferOptions["peaks"]>;

function HiddenTrackMenuIcon() {
  return null;
}

type BatchAnalysisState = {
  status: "idle" | "running" | "complete";
  total: number;
  completed: number;
  failed: number;
  currentTrackTitle: string;
};

const emptyBatchAnalysisState = (): BatchAnalysisState => ({
  status: "idle",
  total: 0,
  completed: 0,
  failed: 0,
  currentTrackTitle: "",
});

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const item = items[nextIndex];
      nextIndex += 1;
      await worker(item);
    }
  });

  await Promise.all(workers);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// Pseudo collection holding SoundCloud search results that were played.
const soundcloudSearchCollectionId = "search";
// Pseudo collection holding tracks the station added to the queue.
const soundcloudStationCollectionId = "station";
const stationBatchSize = 10;

function getQueueSourceTitle(library: LibraryState): string {
  const source = library.selectedSource;
  if (!source) return "Queue";
  if (source.type === "library-tracks") return "Tracks";
  if (source.type === "library-artists") return "Artists";
  if (source.type === "library-albums") return "Albums";
  if (source.type === "folder") {
    if (source.path) return getPathName(source.path);
    return library.folders.find((folder) => folder.id === source.id)?.name || "Folder";
  }
  if (source.type === "playlist") {
    return library.playlists.find((playlist) => playlist.id === source.id)?.name || "Playlist";
  }
  if (source.type === "tag") {
    return (library.tags || []).find((tag) => tag.id === source.id)?.name || "Tag";
  }
  if (source.type === "loved") return "Loved";
  return "Queue";
}

function getSourceScrollKey(source: LibraryState["selectedSource"]): string {
  if (!source) return "none";
  return `${source.type}:${source.id || ""}${source.path ? `:${source.path}` : ""}`;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error) || !error.message) return fallback;

  return error.message.replace(/^Error invoking remote method '[^']+': Error: /, "");
}

function isSoundCloudPlaybackStopError(message: string): boolean {
  return (
    message.includes("SoundCloud temporarily challenged stream requests") ||
    message.includes("SoundCloud only returned a 30 second preview") ||
    message.includes("This SoundCloud track is not available for full playback") ||
    message.includes("SoundCloud did not return a playable stream URL") ||
    message.includes("SoundCloud stream is unavailable")
  );
}

function toLastfmTrackPayload(
  track: LibraryTrack,
  timestamp?: number,
  duration?: number,
): LastfmTrackPayload | null {
  const artist = track.artist.trim();
  const title = track.title.trim();
  if (!artist || !title) return null;

  return {
    artist,
    title,
    album: track.album?.trim() || undefined,
    albumArtist: track.albumArtist?.trim() || undefined,
    duration: duration || track.duration || undefined,
    timestamp,
  };
}

type TrackMatchIndexes = {
  byPath: Map<string, string>;
  byFileName: Map<string, string | null>;
  byMetadata: Map<string, string | null>;
  byTitleArtist: Map<string, string | null>;
};

function normalizeTrackMatchText(value: string | undefined): string {
  return (value || "").trim().toLowerCase();
}

function normalizeTrackMatchPath(value: string | undefined): string {
  return normalizeTrackMatchText(value).replace(/\\/g, "/");
}

function getRoundedDuration(value: number | undefined): string {
  return Number.isFinite(value) && value && value > 0 ? String(Math.round(value)) : "";
}

function getTitleArtistKey(track: Pick<LibraryTrack, "artist" | "title"> | PlaylistImportTrack) {
  const artist = normalizeTrackMatchText(track.artist);
  const title = normalizeTrackMatchText(track.title);
  return artist && title ? `${artist}|${title}` : "";
}

function getMetadataKey(
  track: Pick<LibraryTrack, "artist" | "duration" | "title"> | PlaylistImportTrack,
) {
  const titleArtistKey = getTitleArtistKey(track);
  const duration = getRoundedDuration(track.duration);
  return titleArtistKey && duration ? `${titleArtistKey}|${duration}` : "";
}

function setUniqueTrackMatch(map: Map<string, string | null>, key: string, trackId: string): void {
  if (!key) return;
  const existing = map.get(key);
  map.set(key, existing && existing !== trackId ? null : trackId);
}

function createTrackMatchIndexes(tracksById: LibraryState["tracks"]): TrackMatchIndexes {
  const indexes: TrackMatchIndexes = {
    byPath: new Map(),
    byFileName: new Map(),
    byMetadata: new Map(),
    byTitleArtist: new Map(),
  };

  for (const track of Object.values(tracksById)) {
    const pathKey = normalizeTrackMatchPath(track.path);
    if (pathKey) indexes.byPath.set(pathKey, track.id);
    setUniqueTrackMatch(indexes.byFileName, normalizeTrackMatchText(track.fileName), track.id);
    setUniqueTrackMatch(
      indexes.byFileName,
      normalizeTrackMatchText(track.path.split(/[\\/]/).pop()),
      track.id,
    );
    setUniqueTrackMatch(indexes.byMetadata, getMetadataKey(track), track.id);
    setUniqueTrackMatch(indexes.byTitleArtist, getTitleArtistKey(track), track.id);
  }

  return indexes;
}

function findImportedTrackId(
  track: PlaylistImportTrack,
  indexes: TrackMatchIndexes,
): string | null {
  const pathKey = normalizeTrackMatchPath(track.path);
  if (pathKey) {
    const pathMatch = indexes.byPath.get(pathKey);
    if (pathMatch) return pathMatch;

    const fileNameMatch = indexes.byFileName.get(
      normalizeTrackMatchText(track.path?.split(/[\\/]/).pop()),
    );
    if (fileNameMatch) return fileNameMatch;
  }

  const metadataMatch = indexes.byMetadata.get(getMetadataKey(track));
  if (metadataMatch) return metadataMatch;

  const titleArtistMatch = indexes.byTitleArtist.get(getTitleArtistKey(track));
  return titleArtistMatch || null;
}

function isSoundCloudTrack(track: LibraryTrack): boolean {
  return track.source === "soundcloud" || Boolean(track.soundcloud);
}

function isHlsUrl(url: string): boolean {
  return url.includes(".m3u8") || url.includes("/playlist/");
}

function hasProgressiveSoundCloudTranscoding(track: LibraryTrack): boolean {
  return Boolean(
    track.soundcloud?.transcodings?.some(
      (transcoding) =>
        transcoding.protocol === "progressive" && !transcoding.snipped && transcoding.url,
    ),
  );
}

function hasHlsSoundCloudTranscoding(track: LibraryTrack): boolean {
  return Boolean(
    track.soundcloud?.transcodings?.some(
      (transcoding) => transcoding.protocol === "hls" && !transcoding.snipped && transcoding.url,
    ),
  );
}

function activatedSoundCloudSettings(settings: SoundCloudSettings): SoundCloudSettings {
  const defaults = defaultSoundCloudSettings();
  const previousDefaultCollections: SoundCloudSettings["visibleCollections"] = [
    "playlists",
    "liked-tracks",
    "uploads",
    "reposted-tracks",
  ];
  const visibleCollections = settings.visibleCollections || [];
  const shouldResetCollections =
    visibleCollections.length === 0 ||
    (visibleCollections.length === previousDefaultCollections.length &&
      previousDefaultCollections.every((collection) => visibleCollections.includes(collection)));

  return {
    ...settings,
    enabled: true,
    visibleCollections: shouldResetCollections ? defaults.visibleCollections : visibleCollections,
  };
}

function getUpdateMessageDismissedKey(version: string): string {
  return `playhead:update-message-dismissed:${version}`;
}

const updateMessageLastSeenVersionKey = "playhead:update-message-last-seen-version";

function markUpdateMessageVersionSeen(version: string): void {
  localStorage.setItem(updateMessageLastSeenVersionKey, version);
}

function dismissUpdateMessage(version: string): void {
  localStorage.setItem(getUpdateMessageDismissedKey(version), "true");
  markUpdateMessageVersionSeen(version);
}

export function App() {
  const topGapWindowDragHandlers = useWindowDrag<HTMLDivElement>();
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const playNextTrackOnEndRef = useRef<() => boolean>(() => false);
  const playAdjacentTrackRef = useRef<() => void>(() => {});
  const activeTrackIdRef = useRef<string | null>(null);
  const activeTrackRef = useRef<LibraryTrack | null>(null);
  const lastfmSettingsRef = useRef<LastfmSettings>({
    scrobblingEnabled: true,
    loveSyncEnabled: false,
  });
  const rememberTrackPositionRef = useRef<(trackId: string, time: number) => void>(() => {});
  const clearTrackPositionRef = useRef<(trackId: string) => void>(() => {});
  const volumeRef = useRef(1);
  const audioEngineRef = useRef<PlaybackAudioEngine | null>(null);
  const [isAudioGraphActive, setIsAudioGraphActive] = useState(false);
  const volumeControllerRef = useRef<PlaybackVolumeController | null>(null);
  if (!volumeControllerRef.current) {
    volumeControllerRef.current = new PlaybackVolumeController(
      (nextVolume) => {
        wavesurferRef.current?.setVolume(nextVolume);
      },
      undefined,
      (gain) => audioEngineRef.current?.setBoostGain(gain),
    );
  }
  useEffect(
    () => () => {
      volumeControllerRef.current?.dispose();
    },
    [],
  );
  const didLoadLibraryRef = useRef(false);
  const didRestoreSessionRef = useRef(false);
  const lastPositionSaveRef = useRef(0);
  const selectionAnchorTrackIdRef = useRef<string | null>(null);
  const libraryBrowserSelectionAnchorIdRef = useRef<string | null>(null);
  const trackLoadRequestIdRef = useRef(0);
  const isPlayingRef = useRef(false);
  const playbackAbortRef = useRef<AbortController | null>(null);
  const playbackStatusRef = useRef({ loading: false, copied: false });
  const recoverPlaybackRef = useRef<(track: LibraryTrack, time: number, autoplay: boolean) => void>(
    () => {},
  );
  const trackLoadQueueRef = useRef(Promise.resolve());
  const bpmAnalysisQueueRef = useRef(Promise.resolve());
  const bpmAnalysisTrackIdsRef = useRef(new Set<string>());
  const loadedTrackIdRef = useRef<string | null>(null);
  const lastLibraryBackGestureAtRef = useRef(0);
  const lastfmPlaybackSessionRef = useRef<LastfmPlaybackSession | null>(null);
  const lastfmNowPlayingTrackIdRef = useRef<string | null>(null);
  const libraryRef = useRef<LibraryState>(emptyLibraryState());
  const soundcloudTracksRef = useRef<Record<string, LibraryTrack>>({});
  const soundcloudTrackLoadRequestsRef = useRef<Set<string>>(new Set());
  const sourceScrollPositionsRef = useRef<Record<string, number>>({});

  const [library, setLibrary] = useState<LibraryState>(emptyLibraryState);
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([]);
  const [hasWaveform, setHasWaveform] = useState(false);
  const [playbackClock] = useState(() => new PlaybackClock());
  const [duration, setDuration] = useState(0);
  const [waveformElement, setWaveformElement] = useState<HTMLDivElement | null>(null);
  const [isWaveformEngineReady, setIsWaveformEngineReady] = useState(false);
  const [shouldAnimateWaveform, setShouldAnimateWaveform] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const { scanId, isScanning, startScan, finishScan } = useLibraryScan();
  const [playbackError, setPlaybackError] = useState<PlaybackFailure | null>(null);
  const [preparingPlayback, setPreparingPlayback] = useState(false);
  const [isLoadingTrack, setIsLoadingTrack] = useState(false);
  const [, setError] = useState("");
  const [metadataDialog, setMetadataDialog] = useState<MetadataDialogState>(null);
  const [shuffleEnabled, setShuffleEnabled] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("off");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCreatePlaylistOpen, setIsCreatePlaylistOpen] = useState(false);
  const [isCreateTagOpen, setIsCreateTagOpen] = useState(false);
  const [tracksPendingPlaylistCreation, setTracksPendingPlaylistCreation] = useState<
    LibraryTrack[]
  >([]);
  const [tracksPendingTagCreation, setTracksPendingTagCreation] = useState<LibraryTrack[]>([]);
  const [folderPendingRemoval, setFolderPendingRemoval] = useState<LibraryFolder | null>(null);
  const [playlistPendingDeletion, setPlaylistPendingDeletion] = useState<LibraryPlaylist | null>(
    null,
  );
  const [playerTrackMenuPoint, setPlayerTrackMenuPoint] = useState<MenuAnchorPoint | null>(null);
  const [tagPendingDeletion, setTagPendingDeletion] = useState<LibraryTag | null>(null);
  const [playlistTrackIdsPendingRemoval, setPlaylistTrackIdsPendingRemoval] = useState<string[]>(
    [],
  );
  const [selectedLibraryBrowserItemIds, setSelectedLibraryBrowserItemIds] = useState<string[]>([]);
  const [renamingPlaylistId, setRenamingPlaylistId] = useState<string | null>(null);
  const [renamingTagId, setRenamingTagId] = useState<string | null>(null);
  const [trackScrollRequest, setTrackScrollRequest] = useState<{
    trackId: string;
    align: "center" | "nearest";
    focus: boolean;
  } | null>(null);
  const setScrollToTrackId = useCallback(
    (trackId: string | null, align: "center" | "nearest" = "center", focus = false) => {
      setTrackScrollRequest(trackId ? { trackId, align, focus } : null);
    },
    [],
  );
  const scrollToTrackId = trackScrollRequest?.trackId ?? null;
  const [previewAppTransparency, setPreviewAppTransparency] = useState<number | null>(null);
  const [updateState, setUpdateState] = useState<AppUpdateState>({ status: "idle" });
  const [updateMessage, setUpdateMessage] = useState<{
    version: string;
    message: UpdateMessage;
  } | null>(null);
  const [lastfmState, setLastfmState] = useState<LastfmState>({
    configured: false,
    connected: false,
    pendingAuth: false,
    queueSize: 0,
  });
  const [lastfmActionPending, setLastfmActionPending] = useState(false);
  const [soundcloudState, setSoundCloudState] = useState<SoundCloudState>({
    configured: false,
    connected: false,
    pendingAuth: false,
  });
  const [soundcloudActionPending, setSoundCloudActionPending] = useState(false);
  const [soundcloudCollections, setSoundCloudCollections] = useState<SoundCloudCollection[]>([]);
  const [soundcloudPlaylistDialog, setSoundCloudPlaylistDialog] = useState<
    | { mode: "create"; tracks: LibraryTrack[] }
    | { mode: "rename"; collection: SoundCloudCollection }
    | null
  >(null);
  const [soundcloudPlaylistPendingDeletion, setSoundCloudPlaylistPendingDeletion] =
    useState<SoundCloudCollection | null>(null);
  const [soundcloudLikedTrackIds, setSoundCloudLikedTrackIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [soundcloudTracksByCollection, setSoundCloudTracksByCollection] = useState<
    Record<string, LibraryTrack[]>
  >({});
  const [soundcloudLoadingCollectionId, setSoundCloudLoadingCollectionId] = useState<string | null>(
    null,
  );
  const [batchAnalysis, setBatchAnalysis] = useState<BatchAnalysisState>(emptyBatchAnalysisState);

  const allTracks = useMemo(() => Object.values(library.tracks), [library.tracks]);
  const libraryCollections = useMemo(
    () => getLibraryCollectionsFromTracks(library.tracks),
    [library.tracks],
  );
  const libraryArtists = libraryCollections.artists;
  const libraryAlbums = libraryCollections.albums;
  const trackListSettings = useMemo(
    () => normalizeTrackListSettings(library.settings.session.trackList),
    [library.settings.session.trackList],
  );
  const sourceTracks = useMemo(() => {
    if (library.selectedSource?.type === "soundcloud" && library.selectedSource.id) {
      return soundcloudTracksByCollection[library.selectedSource.id] || [];
    }
    return getSourceTracksFromParts({
      favoriteTrackIds: library.favoriteTrackIds,
      folders: library.folders,
      playlists: library.playlists,
      selectedSource: library.selectedSource,
      tags: library.tags,
      tracks: library.tracks,
    });
  }, [
    library.favoriteTrackIds,
    library.folders,
    library.playlists,
    library.selectedSource,
    library.tags,
    library.tracks,
    soundcloudTracksByCollection,
  ]);
  const tracks = useMemo(
    () => sortTrackList(sourceTracks, trackListSettings.sort),
    [sourceTracks, trackListSettings.sort],
  );
  const allPlayableTracksById = useMemo(
    () => ({
      ...library.tracks,
      ...Object.fromEntries(
        Object.values(soundcloudTracksByCollection)
          .flat()
          .map((track) => [track.id, track]),
      ),
    }),
    [library.tracks, soundcloudTracksByCollection],
  );
  const libraryTrackCount = useMemo(() => Object.keys(library.tracks).length, [library.tracks]);
  const activeTrack = activeTrackId ? allPlayableTracksById[activeTrackId] : null;
  // SoundCloud likes count as loved, so hearts match what the user sees on SoundCloud.
  const favoriteTrackIds = useMemo(
    () =>
      soundcloudLikedTrackIds.size === 0
        ? library.favoriteTrackIds || []
        : Array.from(new Set([...(library.favoriteTrackIds || []), ...soundcloudLikedTrackIds])),
    [library.favoriteTrackIds, soundcloudLikedTrackIds],
  );
  const favoriteTrackSet = useMemo(() => new Set(favoriteTrackIds), [favoriteTrackIds]);
  const activeTags = useMemo(
    () =>
      activeTrack
        ? (library.tags || []).filter((tag) => tag.trackIds.includes(activeTrack.id))
        : [],
    [activeTrack, library.tags],
  );

  useEffect(() => {
    setPlayerTrackMenuPoint(null);
  }, [activeTrack?.id]);

  const selectedLibraryArtist =
    library.selectedSource?.type === "library-artist"
      ? libraryArtists.find((artist) => artist.id === library.selectedSource?.id) || null
      : null;
  const selectedLibraryAlbum =
    library.selectedSource?.type === "library-album"
      ? libraryAlbums.find((album) => album.id === library.selectedSource?.id) || null
      : null;

  const selectedTitle = useMemo(() => {
    const source = library.selectedSource;
    if (!source) return "Library";
    if (source.type === "library-tracks") return "Tracks";
    if (source.type === "library-artists") return "Artists";
    if (source.type === "library-albums") return "Albums";
    if (source.type === "library-artist") {
      return libraryArtists.find((artist) => artist.id === source.id)?.name || "Artist";
    }
    if (source.type === "library-album") {
      return libraryAlbums.find((album) => album.id === source.id)?.title || "Album";
    }
    if (source.type === "folder") {
      if (source.path) return getPathName(source.path);
      return library.folders.find((folder) => folder.id === source.id)?.name || "Folder";
    }
    if (source.type === "loved") return "Loved";
    if (source.type === "soundcloud") {
      return (
        soundcloudCollections.find((collection) => collection.id === source.id)?.title ||
        "SoundCloud"
      );
    }
    if (source.type === "tag") {
      return (library.tags || []).find((tag) => tag.id === source.id)?.name || "Tag";
    }
    return library.playlists.find((playlist) => playlist.id === source.id)?.name || "Playlist";
  }, [
    library.folders,
    library.playlists,
    library.selectedSource,
    library.tags,
    libraryAlbums,
    libraryArtists,
    soundcloudCollections,
  ]);
  // Search can be narrowed to the open folder or playlist, but not to views that already
  // cover the whole library.
  const searchScope = useMemo(() => {
    const type = library.selectedSource?.type;
    if (
      !type ||
      (type.startsWith("library-") && !["library-artist", "library-album"].includes(type))
    )
      return null;
    return tracks.length > 0 ? { title: selectedTitle, tracks } : null;
  }, [library.selectedSource?.type, selectedTitle, tracks]);
  const appTransparency =
    (previewAppTransparency ?? library.settings.appearance.appTransparency) / 100;
  const reduceMotion = library.settings.appearance.reduceMotion;
  const windowCornerRadius = library.settings.appearance.windowCornerRadius;

  useEffect(() => {
    // Set on the root so portaled overlays share the window's corner radius.
    document.documentElement.style.setProperty("--window-radius", `${windowCornerRadius}px`);
  }, [windowCornerRadius]);

  const persistLibrary = useCallback(async (nextState: LibraryState) => {
    libraryRef.current = nextState;
    setLibrary(nextState);
    await window.playhead.saveLibraryState(nextState);
    await window.playhead.watchLibraryFolders(
      nextState.settings.library.watchFolders ? nextState.folders : [],
      nextState.settings.library.enabledAudioExtensions,
    );
  }, []);

  const persistSessionSettings = useCallback((nextSession: LibraryState["settings"]["session"]) => {
    setLibrary((current) => {
      const nextState = {
        ...current,
        settings: { ...current.settings, session: nextSession },
      };
      libraryRef.current = nextState;
      void window.playhead.saveLibrarySessionSettings(nextSession);
      return nextState;
    });
  }, []);

  const saveAnalyzedBpm = useCallback((trackId: string, bpm: number) => {
    setLibrary((current) => {
      const track = current.tracks[trackId];
      if (!track) return current;

      const nextState: LibraryState = {
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

      libraryRef.current = nextState;
      void window.playhead.saveLibraryTrackAnalysis(trackId, bpm);
      return nextState;
    });

    const soundCloudTrack = soundcloudTracksRef.current[trackId];
    if (soundCloudTrack) {
      soundcloudTracksRef.current = {
        ...soundcloudTracksRef.current,
        [trackId]: {
          ...soundCloudTrack,
          bpm,
          bpmSource: "analysis" as const,
        },
      };
    }

    setSoundCloudTracksByCollection((currentCollections) => {
      let changed = false;
      const nextCollections = Object.fromEntries(
        Object.entries(currentCollections).map(([collectionId, collectionTracks]) => {
          const nextTracks = collectionTracks.map((item) => {
            if (item.id !== trackId) return item;
            changed = true;
            return { ...item, bpm, bpmSource: "analysis" as const };
          });
          return [collectionId, nextTracks];
        }),
      );
      return changed ? nextCollections : currentCollections;
    });
  }, []);

  const analyzeTrackBpm = useCallback(
    async (track: LibraryTrack) => {
      if (!shouldAnalyzeTrackBpm(track) || bpmAnalysisTrackIdsRef.current.has(track.id)) return;

      bpmAnalysisTrackIdsRef.current.add(track.id);
      bpmAnalysisQueueRef.current = bpmAnalysisQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          try {
            const request = { trackId: track.id, path: track.path };
            const cachedBpm = await window.playhead.getBpmCache(request);
            if (cachedBpm) {
              saveAnalyzedBpm(track.id, Math.round(cachedBpm.bpm));
              return;
            }

            const buffer = await decodeAudioTrack(track, window.playhead.readAudioFile);
            const { bpm, tempo } = await analyzeBpmFromBuffer(buffer);
            const analyzedAt = new Date().toISOString();
            await window.playhead.saveBpmCache({
              ...request,
              bpm,
              tempo,
              analyzedAt,
            });
            saveAnalyzedBpm(track.id, bpm);
          } catch (error) {
            console.warn("Failed to analyze BPM", { path: track.path, error });
          } finally {
            bpmAnalysisTrackIdsRef.current.delete(track.id);
          }
        });
    },
    [saveAnalyzedBpm],
  );

  const analyzeSoundCloudTrackBpm = useCallback(
    async (track: LibraryTrack) => {
      const soundcloud = track.soundcloud;
      if (!soundcloud) {
        if (import.meta.env.DEV) {
          console.log("[SoundCloud BPM] skipped: missing soundcloud metadata", {
            id: track.id,
            title: track.title,
          });
        }
        return;
      }
      if (!shouldAnalyzeTrackBpm(track)) {
        if (import.meta.env.DEV) {
          console.log("[SoundCloud BPM] skipped: track already has BPM", {
            id: track.id,
            title: track.title,
            bpm: track.bpm,
            bpmSource: track.bpmSource,
          });
        }
        return;
      }
      if (bpmAnalysisTrackIdsRef.current.has(track.id)) {
        if (import.meta.env.DEV) {
          console.log("[SoundCloud BPM] skipped: analysis already queued", {
            id: track.id,
            title: track.title,
          });
        }
        return;
      }

      bpmAnalysisTrackIdsRef.current.add(track.id);
      if (import.meta.env.DEV) {
        console.log("[SoundCloud BPM] queued", {
          id: track.id,
          title: track.title,
          duration: track.duration,
          hls: hasHlsSoundCloudTranscoding(track),
          progressive: hasProgressiveSoundCloudTranscoding(track),
        });
      }
      const nextAnalysis = (bpmAnalysisQueueRef.current = bpmAnalysisQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          const request = { trackId: track.id, path: track.path };

          try {
            if (import.meta.env.DEV) {
              console.log("[SoundCloud BPM] checking cache", request);
            }
            const cachedBpm = await window.playhead.getBpmCache(request);
            if (cachedBpm) {
              if (import.meta.env.DEV) {
                console.log("[SoundCloud BPM] cache hit", {
                  id: track.id,
                  title: track.title,
                  bpm: cachedBpm.bpm,
                  analyzedAt: cachedBpm.analyzedAt,
                });
              }
              saveAnalyzedBpm(track.id, Math.round(cachedBpm.bpm));
              return;
            }

            if (import.meta.env.DEV) {
              console.log("[SoundCloud BPM] cache miss", {
                id: track.id,
                title: track.title,
              });
            }
            if (!track.duration || track.duration > 480) {
              if (import.meta.env.DEV) {
                console.log("[SoundCloud BPM] skipped: duration outside limit", {
                  id: track.id,
                  title: track.title,
                  duration: track.duration,
                });
              }
              return;
            }
            if (import.meta.env.DEV) {
              console.log("[SoundCloud BPM] requesting analysis audio data", {
                id: track.id,
                soundcloudId: soundcloud.id,
                title: track.title,
              });
            }
            const bytes = await window.playhead.getSoundCloudAnalysisAudioData(
              soundcloud.id,
              track.duration,
              soundcloud.transcodings,
              soundcloud.trackAuthorization,
            );
            if (!bytes) {
              if (import.meta.env.DEV) {
                console.log("[SoundCloud BPM] no analysis audio data returned", {
                  id: track.id,
                  title: track.title,
                });
              }
              return;
            }

            if (import.meta.env.DEV) {
              console.log("[SoundCloud BPM] decoding audio data", {
                id: track.id,
                title: track.title,
                bytes: bytes.byteLength,
              });
            }
            const buffer = await decodeAudioBytes(bytes);
            if (import.meta.env.DEV) {
              console.log("[SoundCloud BPM] analyzing decoded audio", {
                id: track.id,
                title: track.title,
                duration: buffer.duration,
                sampleRate: buffer.sampleRate,
              });
            }
            const { bpm, tempo } = await analyzeBpmFromBuffer(buffer);
            if (import.meta.env.DEV) {
              console.log("[SoundCloud BPM] analysis complete", {
                id: track.id,
                title: track.title,
                bpm,
                tempo,
              });
            }
            await window.playhead.saveBpmCache({
              ...request,
              bpm,
              tempo,
              analyzedAt: new Date().toISOString(),
            });
            if (import.meta.env.DEV) {
              console.log("[SoundCloud BPM] cache saved", {
                id: track.id,
                title: track.title,
                bpm,
              });
            }
            saveAnalyzedBpm(track.id, bpm);
          } catch (error) {
            console.warn("Failed to analyze SoundCloud BPM", { path: track.path, error });
          } finally {
            bpmAnalysisTrackIdsRef.current.delete(track.id);
          }
        }));
      await nextAnalysis;
    },
    [saveAnalyzedBpm],
  );

  const getBatchAnalysisCandidates = useCallback(
    async (tracksToCheck: LibraryTrack[]) => {
      const candidates: LibraryTrack[] = [];

      for (const track of tracksToCheck) {
        if (isSoundCloudTrack(track)) {
          const cachedBpm = shouldAnalyzeTrackBpm(track)
            ? await window.playhead.getBpmCache({ trackId: track.id, path: track.path })
            : null;
          if (cachedBpm) saveAnalyzedBpm(track.id, Math.round(cachedBpm.bpm));
          continue;
        }

        const request = { trackId: track.id, path: track.path, duration: track.duration };
        const [cachedWaveform, cachedBpm] = await Promise.all([
          window.playhead.getWaveformCache(request),
          shouldAnalyzeTrackBpm(track)
            ? window.playhead.getBpmCache({ trackId: track.id, path: track.path })
            : Promise.resolve(null),
        ]);

        if (!cachedWaveform || (shouldAnalyzeTrackBpm(track) && !cachedBpm)) {
          candidates.push(track);
          continue;
        }

        if (cachedBpm) saveAnalyzedBpm(track.id, Math.round(cachedBpm.bpm));
      }

      return candidates;
    },
    [saveAnalyzedBpm],
  );

  const analyzeTrackAudioData = useCallback(
    async (track: LibraryTrack) => {
      if (isSoundCloudTrack(track)) {
        await analyzeSoundCloudTrackBpm(track);
        return;
      }

      const waveformRequest = { trackId: track.id, path: track.path, duration: track.duration };
      const bpmRequest = { trackId: track.id, path: track.path };
      const [cachedWaveform, cachedBpm] = await Promise.all([
        window.playhead.getWaveformCache(waveformRequest),
        shouldAnalyzeTrackBpm(track)
          ? window.playhead.getBpmCache(bpmRequest)
          : Promise.resolve(null),
      ]);
      const needsWaveform = !cachedWaveform;
      const needsBpm = shouldAnalyzeTrackBpm(track) && !cachedBpm;

      if (cachedBpm) saveAnalyzedBpm(track.id, Math.round(cachedBpm.bpm));
      if (!needsWaveform && !needsBpm) return;

      const buffer = await decodeAudioTrack(track, window.playhead.readAudioFile);
      const loadedDuration = buffer.duration || track.duration || 0;

      if (needsWaveform) {
        await window.playhead.saveWaveformCache({
          ...waveformRequest,
          duration: loadedDuration,
          peaks: buildWaveformCachePeaks(buffer, loadedDuration),
        });
      }

      if (needsBpm) {
        const { bpm, tempo } = await analyzeBpmFromBuffer(buffer);
        await window.playhead.saveBpmCache({
          ...bpmRequest,
          bpm,
          tempo,
          analyzedAt: new Date().toISOString(),
        });
        saveAnalyzedBpm(track.id, bpm);
      }
    },
    [analyzeSoundCloudTrackBpm, saveAnalyzedBpm],
  );

  const analyzeMissingAudioData = useCallback(async () => {
    if (batchAnalysis.status === "running") return "Audio analysis is already running.";

    const tracksToAnalyze = await getBatchAnalysisCandidates(
      Object.values(libraryRef.current.tracks),
    );
    if (tracksToAnalyze.length === 0) {
      setBatchAnalysis({
        status: "complete",
        total: 0,
        completed: 0,
        failed: 0,
        currentTrackTitle: "",
      });
      return "All tracks already have audio data.";
    }

    setBatchAnalysis({
      status: "running",
      total: tracksToAnalyze.length,
      completed: 0,
      failed: 0,
      currentTrackTitle: tracksToAnalyze[0]?.title || "",
    });

    let completed = 0;
    let failed = 0;

    await runWithConcurrency(tracksToAnalyze, 2, async (track) => {
      setBatchAnalysis((current) => ({
        ...current,
        currentTrackTitle: track.title,
      }));

      try {
        await analyzeTrackAudioData(track);
      } catch (error) {
        failed += 1;
        console.warn("Failed to analyze track audio data", { path: track.path, error });
      } finally {
        completed += 1;
        setBatchAnalysis({
          status: completed === tracksToAnalyze.length ? "complete" : "running",
          total: tracksToAnalyze.length,
          completed,
          failed,
          currentTrackTitle: completed === tracksToAnalyze.length ? "" : track.title,
        });
      }
    });

    return failed > 0
      ? `Audio analysis completed with ${failed} failed track${failed === 1 ? "" : "s"}.`
      : "Audio analysis completed.";
  }, [analyzeTrackAudioData, batchAnalysis.status, getBatchAnalysisCandidates]);

  const destroyHls = useCallback(() => {
    hlsRef.current?.destroy();
    hlsRef.current = null;
  }, []);

  const loadRemoteAudioElement = useCallback(
    async (
      wavesurfer: WaveSurfer,
      audioUrl: string,
      fallbackDuration: number,
      waveformPeaks?: WaveformPeaks | null,
    ) => {
      destroyHls();
      const media = wavesurfer.getMediaElement();
      media.pause();
      media.removeAttribute("src");
      media.load();

      const renderRemoteWaveform = async (waveformDuration: number) => {
        if (!Number.isFinite(waveformDuration) || waveformDuration <= 0) return false;
        if (waveformPeaks?.length) {
          await wavesurfer.load("", waveformPeaks, waveformDuration);
          return true;
        }

        await wavesurfer.load("", [[0]], waveformDuration);
        return false;
      };
      const renderedWaveform = await renderRemoteWaveform(fallbackDuration);

      await new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          media.removeEventListener("loadedmetadata", onLoadedMetadata);
          media.removeEventListener("canplay", onCanPlay);
          media.removeEventListener("error", onError);
        };
        const finish = () => {
          cleanup();
          resolve();
        };
        const onLoadedMetadata = () => finish();
        const onCanPlay = () => finish();
        const onError = () => {
          cleanup();
          reject(new Error("Remote audio could not be loaded."));
        };

        media.addEventListener("loadedmetadata", onLoadedMetadata, { once: true });
        media.addEventListener("canplay", onCanPlay, { once: true });
        media.addEventListener("error", onError, { once: true });

        if (isHlsUrl(audioUrl)) {
          if (Hls.isSupported()) {
            const hls = new Hls({ enableWorker: true });
            hlsRef.current = hls;
            hls.on(Hls.Events.ERROR, (_event, data) => {
              if (data.fatal) {
                cleanup();
                reject(new Error(data.details || "HLS audio could not be loaded."));
              }
            });
            hls.attachMedia(media);
            hls.on(Hls.Events.MEDIA_ATTACHED, () => hls.loadSource(audioUrl));
          } else if (media.canPlayType("application/vnd.apple.mpegurl")) {
            media.src = audioUrl;
          } else {
            cleanup();
            reject(new Error("HLS playback is not supported in this browser."));
          }
        } else {
          media.src = audioUrl;
        }

        media.load();
        if (fallbackDuration > 0) {
          window.setTimeout(() => {
            if (media.readyState > 0) finish();
          }, 1200);
        }
      });

      const mediaDuration = media.duration;
      const waveformDuration =
        Number.isFinite(mediaDuration) && mediaDuration > 0 ? mediaDuration : fallbackDuration;
      if (renderedWaveform) return true;
      return renderRemoteWaveform(waveformDuration);
    },
    [destroyHls],
  );

  const selectTrack = useCallback(
    async (
      track: LibraryTrack,
      autoplay = true,
      requestedStartTime?: number,
      allowSkipUnavailable = true,
      queueMode: "preserve" | "source" = "preserve",
      activeQueueItemId?: string,
      forceLocalCopy = false,
      queueOverride?: PlaybackQueue,
    ) => {
      const wavesurfer = wavesurferRef.current;
      if (!wavesurfer) return;
      const rememberPositions = library.settings.playback.rememberTrackPositions;
      let trackPositions = library.settings.session.trackPositions;
      // Save where the outgoing track stopped as part of this session update; a separate
      // save would be overwritten by the session persisted below.
      const outgoingTrackId = loadedTrackIdRef.current;
      if (rememberPositions && outgoingTrackId && outgoingTrackId !== track.id) {
        trackPositions = withTrackPosition(
          trackPositions,
          outgoingTrackId,
          wavesurfer.getCurrentTime(),
          wavesurfer.getDuration(),
        );
      }
      // Without an explicit start time, resume from the remembered position.
      const startTime =
        requestedStartTime ??
        (rememberPositions ? resumePosition(trackPositions[track.id], track.duration) : 0);
      playbackAbortRef.current?.abort();
      const playbackAbort = new AbortController();
      playbackAbortRef.current = playbackAbort;
      playbackStatusRef.current = { loading: true, copied: forceLocalCopy };
      setPlaybackError(null);
      setPreparingPlayback(false);
      const requestId = trackLoadRequestIdRef.current + 1;
      trackLoadRequestIdRef.current = requestId;
      loadedTrackIdRef.current = null;
      if (!forceLocalCopy) {
        lastfmPlaybackSessionRef.current = null;
        lastfmNowPlayingTrackIdRef.current = null;
      }

      wavesurfer.pause();
      setIsLoadingTrack(true);
      setShouldAnimateWaveform(false);
      setError("");
      setActiveTrackId(track.id);
      playbackClock.setTime(0);
      setDuration(track.duration || 0);
      setIsPlaying(false);
      const nextQueue = queueOverride
        ? queueOverride
        : queueMode === "source"
          ? {
              ...buildQueueFromTracks(
                tracks,
                track.id,
                library.selectedSource
                  ? {
                      ...library.selectedSource,
                      title: getQueueSourceTitle(library),
                    }
                  : null,
                allPlayableTracksById,
                shuffleEnabled,
              ),
              panelOpen: library.settings.session.queue.panelOpen,
            }
          : activeQueueItemId
            ? { ...library.settings.session.queue, activeItemId: activeQueueItemId }
            : setQueueActiveTrack(library.settings.session.queue, track.id);

      persistSessionSettings({
        ...library.settings.session,
        activeTrackId: track.id,
        selectedTrackIds: [track.id],
        queue: nextQueue,
        trackPositions,
      });

      const remoteTrack = isSoundCloudTrack(track);
      try {
        if (!remoteTrack) destroyHls();
        if (
          remoteTrack &&
          (track.soundcloud?.access === "blocked" || track.soundcloud?.access === "preview")
        ) {
          throw new Error("This SoundCloud track is not available for full playback.");
        }
        const audioUrlPromise =
          remoteTrack && track.soundcloud
            ? window.playhead.getSoundCloudStreamUrl(
                track.soundcloud.id,
                track.soundcloud.streamUrl,
                track.soundcloud.transcodings,
                track.soundcloud.trackAuthorization,
              )
            : window.playhead.getAudioFileUrl(track.path);
        const remoteWaveformPeaksPromise =
          remoteTrack && track.soundcloud
            ? window.playhead
                .getSoundCloudWaveformPeaks(track.soundcloud.id, track.soundcloud.waveformUrl)
                .catch((waveformError) => {
                  console.warn("Failed to load SoundCloud waveform", {
                    path: track.path,
                    error: waveformError,
                  });
                  return null;
                })
            : Promise.resolve(null);
        const [audioUrl, remoteWaveformPeaks] = await Promise.all([
          audioUrlPromise,
          remoteWaveformPeaksPromise,
        ]);
        if (requestId !== trackLoadRequestIdRef.current) return;
        const waveformCacheRequest = {
          trackId: track.id,
          path: track.path,
          duration: track.duration,
        };
        const cachedWaveform = remoteTrack
          ? null
          : await waitForPlayback(
              window.playhead.getWaveformCache(waveformCacheRequest),
              playbackAbort.signal,
              2000,
            ).catch(() => null);
        if (requestId !== trackLoadRequestIdRef.current) return;
        setShouldAnimateWaveform(!cachedWaveform);
        if (!cachedWaveform) setHasWaveform(false);

        let remoteHasWaveform = false;
        await (trackLoadQueueRef.current = trackLoadQueueRef.current
          .catch(() => undefined)
          .then(async () => {
            if (requestId !== trackLoadRequestIdRef.current) return;
            if (remoteTrack) {
              remoteHasWaveform = await loadRemoteAudioElement(
                wavesurfer,
                audioUrl,
                track.duration,
                remoteWaveformPeaks,
              );
              return;
            }
            const result = await loadLocalPlayback({
              player: wavesurfer,
              url: audioUrl,
              path: track.path,
              requestId,
              duration: track.duration,
              cached: cachedWaveform,
              startTime,
              autoplay,
              signal: playbackAbort.signal,
              forceCopy: forceLocalCopy,
              api: window.playhead,
              onPreparing: () => {
                if (requestId === trackLoadRequestIdRef.current) setPreparingPlayback(true);
              },
            });
            if (requestId === trackLoadRequestIdRef.current)
              playbackStatusRef.current.copied = result.copied;
          }));
        if (requestId !== trackLoadRequestIdRef.current) return;

        loadedTrackIdRef.current = track.id;
        setHasWaveform(remoteTrack ? remoteHasWaveform : true);
        setDuration(wavesurfer.getDuration() || track.duration || 0);
        if (!cachedWaveform && !remoteTrack) {
          const loadedDuration = wavesurfer.getDuration() || track.duration || 0;
          const maxLength = Math.max(
            1,
            Math.min(waveformCacheMaxPeaks, Math.ceil(loadedDuration * waveformCachePeakRate)),
          );
          const peaks = wavesurfer.exportPeaks({ channels: 1, maxLength, precision: 127 });
          void window.playhead
            .saveWaveformCache({
              ...waveformCacheRequest,
              duration: loadedDuration,
              peaks,
            })
            .catch((cacheError) => {
              console.warn("Failed to cache waveform", { path: track.path, error: cacheError });
            });
        }
        window.playhead.trackEvent("track_loaded", {
          autoplay,
          has_duration: Boolean(track.duration),
          audio_format: track.audioFormat || "unknown",
        });
        if (remoteTrack) void analyzeSoundCloudTrackBpm(track);
        else void analyzeTrackBpm(track);
        if (remoteTrack && startTime > 0) {
          wavesurfer.setTime(clamp(startTime, 0, wavesurfer.getDuration() || startTime));
          playbackClock.setTime(wavesurfer.getCurrentTime());
        }

        playbackClock.setTime(wavesurfer.getCurrentTime());
        if (autoplay && remoteTrack) await wavesurfer.play();
      } catch (loadError) {
        if (requestId !== trackLoadRequestIdRef.current) return;
        console.error("Failed to load track", { path: track.path, error: loadError });
        const failure =
          loadError instanceof PlaybackLoadError ? loadError.failure : playbackFailure(loadError);
        setPlaybackError(failure);
        setIsPlaying(false);
        wavesurfer.pause();
        const loadErrorMessage = getErrorMessage(loadError, "This track could not be loaded.");
        const soundCloudPlaybackStop =
          remoteTrack && isSoundCloudPlaybackStopError(loadErrorMessage);
        loadedTrackIdRef.current = null;
        setError(loadErrorMessage || "This track could not be loaded.");
        setHasWaveform(false);
        setShouldAnimateWaveform(false);
        if (
          autoplay &&
          allowSkipUnavailable &&
          library.settings.playback.skipUnavailableTracks &&
          !soundCloudPlaybackStop &&
          (remoteTrack || failure.kind === "decode")
        ) {
          showTrackActionToast({
            action: "Skipped unavailable track",
            track,
            detail: loadErrorMessage,
          });
          playAdjacentTrackRef.current();
        } else if (soundCloudPlaybackStop) {
          showSimpleActionToast(loadErrorMessage, "error");
        }
      } finally {
        if (requestId === trackLoadRequestIdRef.current) {
          playbackStatusRef.current.loading = false;
          setPreparingPlayback(false);
          setIsLoadingTrack(false);
        }
      }
    },
    [
      allPlayableTracksById,
      library,
      playbackClock,
      analyzeTrackBpm,
      analyzeSoundCloudTrackBpm,
      destroyHls,
      loadRemoteAudioElement,
      persistSessionSettings,
      shuffleEnabled,
      tracks,
    ],
  );

  useEffect(() => {
    recoverPlaybackRef.current = (track, time, autoplay) => {
      void selectTrack(track, autoplay, time, false, "preserve", undefined, true);
    };
  }, [selectTrack]);

  const storeSoundCloudPlaylistTracks = useCallback(
    (collectionId: string, tracks: LibraryTrack[]) => {
      setSoundCloudTracksByCollection((current) => ({ ...current, [collectionId]: tracks }));
      setSoundCloudCollections((current) =>
        current.map((collection) =>
          collection.id === collectionId
            ? { ...collection, trackCount: tracks.length }
            : collection,
        ),
      );
      soundcloudTracksRef.current = {
        ...soundcloudTracksRef.current,
        ...Object.fromEntries(tracks.map((track) => [track.id, track])),
      };
    },
    [],
  );

  const toSoundCloudIds = useCallback(
    (trackIds: string[]) =>
      trackIds.flatMap((trackId) => {
        const id = allPlayableTracksById[trackId]?.soundcloud?.id;
        return id === undefined ? [] : [id];
      }),
    [allPlayableTracksById],
  );

  const editSoundCloudPlaylist = useCallback(
    async (collectionId: string, edit: SoundCloudPlaylistEdit) => {
      const { changed, tracks } = await window.playhead.editSoundCloudPlaylist(collectionId, edit);
      storeSoundCloudPlaylistTracks(collectionId, tracks);
      return changed;
    },
    [storeSoundCloudPlaylistTracks],
  );

  const soundCloudCollectionTitle = useCallback(
    (collectionId: string) =>
      soundcloudCollections.find((collection) => collection.id === collectionId)?.title ||
      "playlist",
    [soundcloudCollections],
  );

  const addTracksToSoundCloudPlaylist = useCallback(
    async (trackIds: string[], playlist: SoundCloudCollection, move = false) => {
      const soundcloudIds = toSoundCloudIds(trackIds);
      if (soundcloudIds.length === 0) {
        showSimpleActionToast(
          "Only SoundCloud tracks can be added to SoundCloud playlists.",
          "info",
        );
        return;
      }
      // Moving only makes sense out of another SoundCloud playlist.
      const source = library.selectedSource;
      const moveFrom =
        move &&
        source?.type === "soundcloud" &&
        source.id?.startsWith("playlist:") &&
        source.id !== playlist.id
          ? source.id
          : null;
      try {
        const added = await editSoundCloudPlaylist(playlist.id, {
          type: "add",
          trackIds: soundcloudIds,
        });
        if (moveFrom) {
          await editSoundCloudPlaylist(moveFrom, { type: "remove", trackIds: soundcloudIds });
          showSimpleActionToast(
            `Moved ${soundcloudIds.length} ${soundcloudIds.length === 1 ? "track" : "tracks"} to ${playlist.title}`,
          );
          return;
        }
        showSimpleActionToast(
          added === 0
            ? `Already in ${playlist.title}`
            : `Added ${added} ${added === 1 ? "track" : "tracks"} to ${playlist.title}`,
          added === 0 ? "info" : "success",
        );
      } catch (error) {
        showSimpleActionToast(
          getErrorMessage(error, "Could not update the SoundCloud playlist."),
          "error",
        );
      }
    },
    [editSoundCloudPlaylist, library.selectedSource, toSoundCloudIds],
  );

  const createSoundCloudPlaylist = useCallback(
    async (title: string, tracksToAdd: LibraryTrack[]) => {
      try {
        const collection = await window.playhead.createSoundCloudPlaylist(
          title,
          toSoundCloudIds(tracksToAdd.map((track) => track.id)),
        );
        setSoundCloudCollections((current) => {
          // Keep playlists together, newest first, ahead of the other collections.
          const playlists = current.filter((item) => item.id.startsWith("playlist:"));
          const others = current.filter((item) => !item.id.startsWith("playlist:"));
          return [collection, ...playlists, ...others];
        });
        showSimpleActionToast(`Created ${collection.title} on SoundCloud (private)`);
      } catch (error) {
        showSimpleActionToast(
          getErrorMessage(error, "Could not create the SoundCloud playlist."),
          "error",
        );
      }
    },
    [toSoundCloudIds],
  );

  const renameSoundCloudPlaylist = useCallback(
    async (collection: SoundCloudCollection, title: string) => {
      const rename = (nextTitle: string) =>
        setSoundCloudCollections((current) =>
          current.map((item) => (item.id === collection.id ? { ...item, title: nextTitle } : item)),
        );
      rename(title);
      try {
        await window.playhead.renameSoundCloudPlaylist(collection.id, title);
      } catch (error) {
        rename(collection.title);
        showSimpleActionToast(
          getErrorMessage(error, "Could not rename the SoundCloud playlist."),
          "error",
        );
      }
    },
    [],
  );

  const removeTracksFromSoundCloudPlaylist = useCallback(
    async (collectionId: string, trackIds: string[]) => {
      const soundcloudIds = toSoundCloudIds(trackIds);
      if (soundcloudIds.length === 0) return;
      try {
        const removed = await editSoundCloudPlaylist(collectionId, {
          type: "remove",
          trackIds: soundcloudIds,
        });
        showSimpleActionToast(
          `Removed ${removed} ${removed === 1 ? "track" : "tracks"} from ${soundCloudCollectionTitle(collectionId)}`,
        );
      } catch (error) {
        showSimpleActionToast(
          getErrorMessage(error, "Could not update the SoundCloud playlist."),
          "error",
        );
      }
    },
    [editSoundCloudPlaylist, soundCloudCollectionTitle, toSoundCloudIds],
  );

  const reorderSoundCloudPlaylist = useCallback(
    async (
      collectionId: string,
      trackIds: string[],
      targetTrackId: string,
      edge: "before" | "after" = "before",
    ) => {
      const target = allPlayableTracksById[targetTrackId]?.soundcloud?.id;
      const current = soundcloudTracksByCollection[collectionId];
      if (target === undefined || !current) return;
      const edit = {
        type: "move" as const,
        trackIds: toSoundCloudIds(trackIds),
        targetTrackId: target,
        edge,
      };
      // Reorder locally straight away; SoundCloud's copy follows.
      const byId = new Map(current.map((track) => [track.soundcloud?.id, track]));
      const reordered = applySoundCloudPlaylistEdit(
        current.flatMap((track) => (track.soundcloud ? [track.soundcloud.id] : [])),
        edit,
      ).flatMap((id) => byId.get(id) ?? []);
      storeSoundCloudPlaylistTracks(collectionId, reordered);
      try {
        await editSoundCloudPlaylist(collectionId, edit);
      } catch (error) {
        storeSoundCloudPlaylistTracks(collectionId, current);
        showSimpleActionToast(
          getErrorMessage(error, "Could not reorder the SoundCloud playlist."),
          "error",
        );
      }
    },
    [
      allPlayableTracksById,
      editSoundCloudPlaylist,
      soundcloudTracksByCollection,
      storeSoundCloudPlaylistTracks,
      toSoundCloudIds,
    ],
  );

  const playSearchResult = useCallback(
    async (track: LibraryTrack, context: SearchSelectContext) => {
      setSelectedTrackIds([track.id]);
      setScrollToTrackId(track.id);
      setIsSearchOpen(false);
      if (context.mode === "soundcloud") {
        // Results live outside any collection; keep them playable and queue the result list.
        setSoundCloudTracksByCollection((current) => {
          const kept = (current[soundcloudSearchCollectionId] || []).filter(
            (item) => !context.results.some((result) => result.id === item.id),
          );
          return { ...current, [soundcloudSearchCollectionId]: [...kept, ...context.results] };
        });
        soundcloudTracksRef.current = {
          ...soundcloudTracksRef.current,
          ...Object.fromEntries(context.results.map((item) => [item.id, item])),
        };
        const tracksById = Object.fromEntries(context.results.map((item) => [item.id, item]));
        const queue = {
          ...buildQueueFromTracks(
            context.results,
            track.id,
            {
              type: "soundcloud" as const,
              id: soundcloudSearchCollectionId,
              title: "SoundCloud search",
            },
            tracksById,
            shuffleEnabled,
          ),
          panelOpen: library.settings.session.queue.panelOpen,
        };
        await selectTrack(track, true, undefined, true, "preserve", undefined, false, queue);
        return;
      }
      if (context.mode === "scope") {
        // The track is already in the open folder/playlist, so play it in place.
        await selectTrack(track, true, undefined, true, "source");
        return;
      }
      await persistLibrary({
        ...library,
        selectedSource:
          library.settings.library.mode === "library"
            ? { type: "library-tracks" }
            : { type: "folder", id: track.folderId },
      });
      await selectTrack(track, true);
    },
    [library, persistLibrary, selectTrack, setScrollToTrackId, shuffleEnabled],
  );

  const addFolder = useCallback(async () => {
    const scanId = startScan();
    if (!scanId) return;
    setError("");

    try {
      const result = await window.playhead.scanLibrary({
        id: scanId,
        extensions: library.settings.library.enabledAudioExtensions,
      });
      if (result.status === "cancelled") return;
      const scannedFolders = result.folders;
      if (scannedFolders.length === 0) return;
      let nextState = libraryRef.current;
      let lastScannedFolderId: string | null = null;
      const scannedFolderIds: string[] = [];

      for (const scanned of scannedFolders) {
        nextState = mergeScannedFolder(nextState, scanned);
        lastScannedFolderId = scanned.folder.id;
        scannedFolderIds.push(scanned.folder.id);
        window.playhead.trackEvent("folder_added", {
          source: "picker",
          track_count: scanned.tracks.length,
        });
        showFolderActionToast({ folder: scanned.folder, trackCount: scanned.tracks.length });
      }

      const latest = libraryRef.current;
      await persistLibrary(
        mergeScannedLibraryState(latest, nextState, scannedFolderIds, {
          allowNewFolders: true,
          selectedSource:
            latest.settings.library.mode === "library"
              ? { type: "library-tracks" as const }
              : lastScannedFolderId
                ? { type: "folder" as const, id: lastScannedFolderId }
                : latest.selectedSource,
        }),
      );
    } catch (error) {
      const message = getErrorMessage(error, "Could not scan that folder.");
      setError(message);
      showSimpleActionToast(message, "error");
    } finally {
      finishScan(scanId);
    }
  }, [library, persistLibrary, startScan, finishScan]);

  const addFolderPaths = useCallback(
    async (folderPaths: string[]) => {
      const uniqueFolderPaths = Array.from(new Set(folderPaths));
      if (uniqueFolderPaths.length === 0) return;

      const scanId = startScan();
      if (!scanId) return;
      setError("");

      try {
        let nextState = libraryRef.current;
        let lastScannedFolderId: string | null = null;
        const scannedFolderIds: string[] = [];

        const result = await window.playhead.scanLibrary({
          id: scanId,
          paths: uniqueFolderPaths,
          extensions: library.settings.library.enabledAudioExtensions,
        });
        if (result.status === "cancelled") return;
        const scannedFolders = result.folders;
        for (const scanned of scannedFolders) {
          nextState = mergeScannedFolder(nextState, scanned);
          lastScannedFolderId = scanned.folder.id;
          scannedFolderIds.push(scanned.folder.id);
          window.playhead.trackEvent("folder_added", {
            source: "drop",
            track_count: scanned.tracks.length,
          });
          showFolderActionToast({ folder: scanned.folder, trackCount: scanned.tracks.length });
        }

        const latest = libraryRef.current;
        await persistLibrary(
          mergeScannedLibraryState(latest, nextState, scannedFolderIds, {
            allowNewFolders: true,
            selectedSource:
              latest.settings.library.mode === "library"
                ? { type: "library-tracks" as const }
                : lastScannedFolderId
                  ? { type: "folder" as const, id: lastScannedFolderId }
                  : latest.selectedSource,
          }),
        );
      } catch (error) {
        const message = getErrorMessage(error, "Drop folders that contain audio files.");
        setError(message);
        showSimpleActionToast(message, "error");
      } finally {
        finishScan(scanId);
      }
    },
    [library, persistLibrary, startScan, finishScan],
  );

  const rescanLibrary = useCallback(
    async (state: LibraryState, options: { preserveView?: boolean } = {}) => {
      if (state.folders.length === 0) {
        await persistLibrary(state);
        return;
      }

      const scanId = startScan();
      if (!scanId) return;
      setError("");

      try {
        let nextState = state;
        const scannedFolderIds = state.folders.map((folder) => folder.id);
        const result = await window.playhead.scanLibrary({
          id: scanId,
          paths: state.folders.map((folder) => folder.path),
          extensions: state.settings.library.enabledAudioExtensions,
        });
        if (result.status === "cancelled") return;
        const scannedFolders = result.folders;
        for (const scanned of scannedFolders) {
          nextState = mergeScannedFolder(nextState, scanned);
        }
        const latest = libraryRef.current;
        const persistedState = mergeScannedLibraryState(latest, nextState, scannedFolderIds, {
          ...(options.preserveView ? {} : { selectedSource: state.selectedSource }),
          settings: options.preserveView
            ? latest.settings
            : { ...state.settings, session: latest.settings.session },
        });
        if (activeTrackId && !persistedState.tracks[activeTrackId]) {
          playbackAbortRef.current?.abort();
          trackLoadRequestIdRef.current++;
          loadedTrackIdRef.current = null;
          playbackStatusRef.current.loading = false;
          setPlaybackError(null);
          setPreparingPlayback(false);
          setIsLoadingTrack(false);
          wavesurferRef.current?.stop();
          wavesurferRef.current?.empty();
          setActiveTrackId(null);
          playbackClock.setTime(0);
          setDuration(0);
          setIsPlaying(false);
          setHasWaveform(false);
          setShouldAnimateWaveform(false);
        }

        await persistLibrary(persistedState);
      } catch (error) {
        const message = getErrorMessage(error, "Could not rescan the library.");
        setError(message);
        showSimpleActionToast(message, "error");
      } finally {
        finishScan(scanId);
      }
    },
    [activeTrackId, persistLibrary, playbackClock, startScan, finishScan],
  );

  const updateLibrarySettings = useCallback(
    async (settings: LibrarySettings) => {
      const nextLibrarySettings = { ...settings, watchFolders: true };
      const onlyDisplaySettingsChanged =
        (nextLibrarySettings.mode !== library.settings.library.mode ||
          nextLibrarySettings.showSubfolders !== library.settings.library.showSubfolders) &&
        nextLibrarySettings.watchFolders === library.settings.library.watchFolders &&
        nextLibrarySettings.rescanOnLaunch === library.settings.library.rescanOnLaunch &&
        nextLibrarySettings.enabledAudioExtensions.join("|") ===
          library.settings.library.enabledAudioExtensions.join("|");
      const nextState = {
        ...library,
        selectedSource:
          nextLibrarySettings.mode !== library.settings.library.mode
            ? nextLibrarySettings.mode === "library"
              ? { type: "library-tracks" as const }
              : library.folders[0]
                ? { type: "folder" as const, id: library.folders[0].id }
                : null
            : !nextLibrarySettings.showSubfolders && library.selectedSource?.type === "folder"
              ? { type: "folder" as const, id: library.selectedSource.id }
              : library.selectedSource,
        settings: { ...library.settings, library: nextLibrarySettings },
      };
      if (onlyDisplaySettingsChanged) {
        await persistLibrary(nextState);
        return;
      }
      await rescanLibrary(nextState);
    },
    [library, persistLibrary, rescanLibrary],
  );

  const updateLibraryMode = useCallback(
    async (mode: LibraryMode) => {
      await persistLibrary({
        ...library,
        selectedSource:
          mode === "library"
            ? { type: "library-tracks" }
            : library.folders[0]
              ? { type: "folder", id: library.folders[0].id }
              : null,
        settings: {
          ...library.settings,
          library: { ...library.settings.library, mode },
        },
      });
    },
    [library, persistLibrary],
  );

  const updatePlaybackSettings = useCallback(
    async (settings: PlaybackSettings) => {
      await persistLibrary({
        ...library,
        settings: { ...library.settings, playback: settings },
      });
    },
    [library, persistLibrary],
  );

  const updateAppearanceSettings = useCallback(
    async (settings: AppearanceSettings) => {
      setPreviewAppTransparency(null);
      await persistLibrary({
        ...library,
        settings: { ...library.settings, appearance: settings },
      });
    },
    [library, persistLibrary],
  );

  const updateTelemetrySettings = useCallback(
    async (settings: TelemetrySettings) => {
      await persistLibrary({
        ...library,
        settings: { ...library.settings, telemetry: settings },
      });
      if (settings.enabled && !library.settings.telemetry.enabled) {
        window.playhead.trackEvent("telemetry_enabled");
      }
    },
    [library, persistLibrary],
  );

  const updateLastfmSettings = useCallback(
    async (settings: LastfmSettings) => {
      await persistLibrary({
        ...library,
        settings: { ...library.settings, lastfm: settings },
      });
    },
    [library, persistLibrary],
  );

  const runLastfmAction = useCallback(async (action: () => Promise<LastfmState>) => {
    setLastfmActionPending(true);
    try {
      const nextState = await action();
      setLastfmState(nextState);
      if (nextState.lastError) showSimpleActionToast(nextState.lastError, "error");
    } catch (error) {
      showSimpleActionToast(
        error instanceof Error ? error.message : "Last.fm action failed.",
        "error",
      );
    } finally {
      setLastfmActionPending(false);
    }
  }, []);

  const startLastfmAuth = useCallback(() => {
    void runLastfmAction(() => window.playhead.startLastfmAuth());
  }, [runLastfmAction]);

  const completeLastfmAuth = useCallback(() => {
    void runLastfmAction(() => window.playhead.completeLastfmAuth());
  }, [runLastfmAction]);

  const disconnectLastfm = useCallback(() => {
    void runLastfmAction(() => window.playhead.disconnectLastfm());
  }, [runLastfmAction]);

  const flushLastfmQueue = useCallback(() => {
    void runLastfmAction(() => window.playhead.flushLastfmQueue());
  }, [runLastfmAction]);

  const updateSoundCloudSettings = useCallback(
    async (settings: SoundCloudSettings) => {
      await persistLibrary({
        ...library,
        settings: { ...library.settings, soundcloud: settings },
      });
    },
    [library, persistLibrary],
  );

  const applySoundCloudActivationDefaults = useCallback(async () => {
    const currentLibrary = libraryRef.current;
    const currentSettings = currentLibrary.settings.soundcloud;
    const nextSettings = activatedSoundCloudSettings(currentSettings);
    if (
      currentSettings.enabled === nextSettings.enabled &&
      currentSettings.visibleCollections.join("|") === nextSettings.visibleCollections.join("|")
    ) {
      return;
    }

    await persistLibrary({
      ...currentLibrary,
      settings: { ...currentLibrary.settings, soundcloud: nextSettings },
    });
  }, [persistLibrary]);

  const runSoundCloudAction = useCallback(async (action: () => Promise<SoundCloudState>) => {
    setSoundCloudActionPending(true);
    try {
      const nextState = await action();
      setSoundCloudState(nextState);
      if (nextState.lastError) showSimpleActionToast(nextState.lastError, "error");
    } catch (error) {
      showSimpleActionToast(
        error instanceof Error ? error.message : "SoundCloud action failed.",
        "error",
      );
    } finally {
      setSoundCloudActionPending(false);
    }
  }, []);

  const startSoundCloudAuth = useCallback(() => {
    void runSoundCloudAction(() => window.playhead.startSoundCloudAuth());
  }, [runSoundCloudAction]);

  const completeSoundCloudAuth = useCallback(
    (input: string) => {
      void runSoundCloudAction(async () => {
        const nextState = await window.playhead.completeSoundCloudAuth(input);
        if (nextState.connected) await applySoundCloudActivationDefaults();
        return nextState;
      });
    },
    [applySoundCloudActivationDefaults, runSoundCloudAction],
  );

  const cancelSoundCloudAuth = useCallback(() => {
    void runSoundCloudAction(() => window.playhead.cancelSoundCloudAuth());
  }, [runSoundCloudAction]);

  const disconnectSoundCloud = useCallback(() => {
    void runSoundCloudAction(async () => {
      const nextState = await window.playhead.disconnectSoundCloud();
      setSoundCloudCollections([]);
      setSoundCloudTracksByCollection({});
      soundcloudTracksRef.current = {};
      return nextState;
    });
  }, [runSoundCloudAction]);

  const loadSoundCloudCollections = useCallback(async () => {
    const settings = libraryRef.current.settings.soundcloud;
    if (!settings.enabled || !soundcloudState.connected) return;
    try {
      const collections = await window.playhead.getSoundCloudCollections(
        settings.visibleCollections,
      );
      setSoundCloudCollections(collections);
    } catch (error) {
      showSimpleActionToast(
        error instanceof Error ? error.message : "Could not load SoundCloud collections.",
        "error",
      );
    }
  }, [soundcloudState.connected]);

  const loadSoundCloudCollectionTracks = useCallback(
    async (collectionId: string) => {
      const collection = soundcloudCollections.find((item) => item.id === collectionId);
      const cachedTracks = soundcloudTracksByCollection[collectionId];
      if (cachedTracks) {
        if (collection && collection.trackCount === undefined) {
          setSoundCloudCollections((current) =>
            current.map((item) =>
              item.id === collectionId ? { ...item, trackCount: cachedTracks.length } : item,
            ),
          );
          return;
        }
        if (cachedTracks.length > 0 || collection?.trackCount === 0 || !collection) return;
      }
      if (soundcloudTrackLoadRequestsRef.current.has(collectionId)) return;

      soundcloudTrackLoadRequestsRef.current.add(collectionId);
      setSoundCloudLoadingCollectionId(collectionId);
      try {
        const nextTracks = await window.playhead.getSoundCloudCollectionTracks(collectionId);
        if (!nextTracks.length && collection?.trackCount) {
          throw new Error(`Could not load tracks for "${collection.title}".`);
        }
        if (import.meta.env.DEV) {
          console.table(
            nextTracks.map((track) => ({
              collection: collection?.title || collectionId,
              title: track.title,
              artist: track.artist,
              id: track.id,
              progressive: hasProgressiveSoundCloudTranscoding(track),
              hls: hasHlsSoundCloudTranscoding(track),
              bpmAnalysis: track.duration > 0 && track.duration <= 480 ? "eligible" : "too long",
              transcodings:
                track.soundcloud?.transcodings
                  ?.map(
                    (transcoding) =>
                      `${transcoding.protocol || "unknown"}:${
                        transcoding.mimeType || transcoding.preset || "unknown"
                      }${transcoding.snipped ? ":snipped" : ""}`,
                  )
                  .join(", ") || "",
            })),
          );
        }
        setSoundCloudTracksByCollection((current) => ({ ...current, [collectionId]: nextTracks }));
        setSoundCloudCollections((current) =>
          current.map((item) =>
            item.id === collectionId && item.trackCount === undefined
              ? { ...item, trackCount: nextTracks.length }
              : item,
          ),
        );
        soundcloudTracksRef.current = {
          ...soundcloudTracksRef.current,
          ...Object.fromEntries(nextTracks.map((track) => [track.id, track])),
        };
      } catch (error) {
        showSimpleActionToast(
          error instanceof Error ? error.message : "Could not load SoundCloud tracks.",
          "error",
        );
      } finally {
        soundcloudTrackLoadRequestsRef.current.delete(collectionId);
        setSoundCloudLoadingCollectionId((current) => (current === collectionId ? null : current));
      }
    },
    [soundcloudCollections, soundcloudTracksByCollection],
  );

  const clearPlaybackState = useCallback(() => {
    destroyHls();
    playbackAbortRef.current?.abort();
    trackLoadRequestIdRef.current++;
    loadedTrackIdRef.current = null;
    playbackStatusRef.current.loading = false;
    setPlaybackError(null);
    setPreparingPlayback(false);
    setIsLoadingTrack(false);
    wavesurferRef.current?.stop();
    wavesurferRef.current?.empty();
    setActiveTrackId(null);
    setSelectedTrackIds([]);
    setScrollToTrackId(null);
    setHasWaveform(false);
    setShouldAnimateWaveform(false);
    playbackClock.setTime(0);
    setDuration(0);
    setIsPlaying(false);
    setIsLoadingTrack(false);
    setError("");
  }, [destroyHls, playbackClock, setScrollToTrackId]);

  useEffect(() => {
    if (activeTrackId && !allPlayableTracksById[activeTrackId]) clearPlaybackState();
  }, [activeTrackId, allPlayableTracksById, clearPlaybackState]);

  const runAdvancedSettingsAction = useCallback(
    async (action: AdvancedSettingsAction) => {
      if (action === "open-data-folder") {
        await window.playhead.openDataFolder();
        return "Data folder opened.";
      }

      if (action === "clear-waveform-cache") {
        await window.playhead.clearWaveformCache();
        return "Waveform cache cleared.";
      }

      if (action === "rebuild-library-index") {
        if (library.folders.length === 0) return "Add a folder before rebuilding the library.";
        await rescanLibrary(library);
        return "Library index rebuilt.";
      }

      if (action === "reset-app-state") {
        clearPlaybackState();
        await persistLibrary({
          ...library,
          settings: { ...library.settings, session: defaultSessionSettings() },
        });
        return "App state reset.";
      }

      if (action === "export-library-backup") {
        const exported = await window.playhead.exportLibraryBackup(library);
        return exported ? "Library backup exported." : "Export canceled.";
      }

      if (action === "import-library-backup") {
        const imported = await window.playhead.importLibraryBackup();
        if (!imported) return "Import canceled.";
        const nextImported = normalizeSourceForMode(imported);
        clearPlaybackState();
        setLibrary(nextImported);
        await window.playhead.watchLibraryFolders(
          nextImported.settings.library.watchFolders ? nextImported.folders : [],
          nextImported.settings.library.enabledAudioExtensions,
        );
        if (nextImported !== imported) await window.playhead.saveLibraryState(nextImported);
        return "Library backup imported.";
      }

      return "Unknown advanced action.";
    },
    [clearPlaybackState, library, persistLibrary, rescanLibrary],
  );

  const removeFolderFromPlayhead = useCallback(
    async (folderId: string) => {
      const removedTrackIds = new Set(
        Object.values(library.tracks)
          .filter((track) => track.folderId === folderId)
          .map((track) => track.id),
      );
      const nextTracks = Object.fromEntries(
        Object.entries(library.tracks).filter(([trackId]) => !removedTrackIds.has(trackId)),
      );
      const nextFolders = library.folders.filter((folder) => folder.id !== folderId);
      const selectedSource =
        library.selectedSource?.type === "folder" && library.selectedSource.id === folderId
          ? library.settings.library.mode === "library"
            ? { type: "library-tracks" as const }
            : nextFolders[0]
              ? { type: "folder" as const, id: nextFolders[0].id }
              : library.playlists[0]
                ? { type: "playlist" as const, id: library.playlists[0].id }
                : null
          : library.selectedSource;

      if (activeTrackId && removedTrackIds.has(activeTrackId)) {
        playbackAbortRef.current?.abort();
        trackLoadRequestIdRef.current++;
        loadedTrackIdRef.current = null;
        playbackStatusRef.current.loading = false;
        setPlaybackError(null);
        setPreparingPlayback(false);
        setIsLoadingTrack(false);
        wavesurferRef.current?.stop();
        wavesurferRef.current?.empty();
        setActiveTrackId(null);
        playbackClock.setTime(0);
        setDuration(0);
        setIsPlaying(false);
        setHasWaveform(false);
        setShouldAnimateWaveform(false);
      }

      await persistLibrary({
        ...library,
        folders: nextFolders,
        tracks: nextTracks,
        playlists: library.playlists.map((playlist) => ({
          ...playlist,
          trackIds: playlist.trackIds.filter((trackId) => !removedTrackIds.has(trackId)),
        })),
        tags: (library.tags || []).map((tag) => ({
          ...tag,
          trackIds: tag.trackIds.filter((trackId) => !removedTrackIds.has(trackId)),
        })),
        favoriteTrackIds: (library.favoriteTrackIds || []).filter(
          (trackId) => !removedTrackIds.has(trackId),
        ),
        selectedSource,
      });
    },
    [activeTrackId, library, persistLibrary, playbackClock],
  );

  const syncSoundCloudLike = useCallback(async (track: LibraryTrack, liked: boolean) => {
    const soundcloud = track.soundcloud;
    if (!soundcloud) return;
    const apply = (isLiked: boolean) => {
      setSoundCloudLikedTrackIds((current) => {
        const next = new Set(current);
        if (isLiked) next.add(track.id);
        else next.delete(track.id);
        return next;
      });
      // Keep an already loaded Loved Tracks collection in step with the like.
      setSoundCloudTracksByCollection((current) => {
        const likedTracks = current["liked-tracks"];
        if (!likedTracks) return current;
        const without = likedTracks.filter((item) => item.id !== track.id);
        return { ...current, "liked-tracks": isLiked ? [track, ...without] : without };
      });
      setSoundCloudCollections((current) =>
        current.map((collection) =>
          collection.id === "liked-tracks" && collection.trackCount !== undefined
            ? { ...collection, trackCount: Math.max(0, collection.trackCount + (isLiked ? 1 : -1)) }
            : collection,
        ),
      );
    };
    apply(liked);
    try {
      await window.playhead.setSoundCloudTrackLiked(soundcloud.id, soundcloud.urn, liked);
    } catch (error) {
      apply(!liked);
      showSimpleActionToast(
        getErrorMessage(error, "Could not update the like on SoundCloud."),
        "error",
      );
    }
  }, []);

  const toggleFavoriteTrack = useCallback(
    async (trackId: string) => {
      const track = allPlayableTracksById[trackId];
      if (!track) return;
      const favoriteTrackIds = new Set(library.favoriteTrackIds || []);
      const wasFavorite = favoriteTrackIds.has(trackId) || soundcloudLikedTrackIds.has(trackId);
      if (wasFavorite) favoriteTrackIds.delete(trackId);
      else favoriteTrackIds.add(trackId);
      if (
        track.soundcloud &&
        soundcloudState.connected &&
        library.settings.soundcloud.likeSyncEnabled
      )
        void syncSoundCloudLike(track, !wasFavorite);

      await persistLibrary({
        ...library,
        tracks: {
          ...library.tracks,
          [track.id]: track,
        },
        favoriteTrackIds: Array.from(favoriteTrackIds),
        selectedSource:
          favoriteTrackIds.size === 0 && library.selectedSource?.type === "loved"
            ? library.folders[0]
              ? { type: "folder", id: library.folders[0].id }
              : null
            : library.selectedSource,
      });
      window.playhead.trackEvent(wasFavorite ? "track_unfavorited" : "track_favorited");
      const lastfmPayload = track ? toLastfmTrackPayload(track) : null;
      if (lastfmPayload && library.settings.lastfm.loveSyncEnabled) {
        void (
          wasFavorite
            ? window.playhead.unloveLastfmTrack(lastfmPayload)
            : window.playhead.loveLastfmTrack(lastfmPayload)
        ).then(setLastfmState);
      }

      showTrackActionToast({
        action: wasFavorite ? "Removed from Loved" : "Added to Loved",
        track,
      });
    },
    [
      allPlayableTracksById,
      library,
      persistLibrary,
      soundcloudLikedTrackIds,
      soundcloudState.connected,
      syncSoundCloudLike,
    ],
  );

  const saveTrackMetadata = useCallback(
    async (track: LibraryTrack, metadata: EditableTrackMetadata) => {
      const updatedTrack = await window.playhead.saveTrackMetadata(
        track.path,
        track.folderId,
        metadata,
      );
      const nextState = {
        ...library,
        tracks: {
          ...library.tracks,
          [track.id]: updatedTrack,
        },
      };

      await persistLibrary(nextState);
      setMetadataDialog({ track: updatedTrack });
      showTrackActionToast({ action: "Metadata saved", track: updatedTrack });
      return updatedTrack;
    },
    [library, persistLibrary],
  );

  const {
    createNewPlaylist,
    createNewTag,
    renamePlaylist,
    deletePlaylist,
    renameTag,
    deleteTag,
    removeTracksFromSelectedPlaylist,
    requestRemoveTracksFromSelectedPlaylist,
    addTrackToPlaylist,
    addTracksToPlaylist,
    addTracksToTag,
    removeTracksFromSelectedTag,
  } = useLibraryActions({
    library,
    availableTracks: allPlayableTracksById,
    persistLibrary,
    setIsCreatePlaylistOpen,
    setTracksPendingPlaylistCreation,
    setIsCreateTagOpen,
    setTracksPendingTagCreation,
    setPlaylistTrackIdsPendingRemoval,
    setRenamingPlaylistId,
    setRenamingTagId,
  });

  const exportPlaylist = useCallback(
    async (playlist: LibraryPlaylist, format: PlaylistExportFormat) => {
      try {
        const result = await window.playhead.exportPlaylist({
          playlistId: playlist.id,
          format,
        });
        if (result.canceled) return;

        const skippedDetail =
          result.skippedTrackCount > 0 ? ` ${result.skippedTrackCount} unavailable skipped.` : "";
        showSimpleActionToast(
          `${playlist.name} exported as ${playlistExportFormatLabels[format]}.${skippedDetail}`,
        );
        window.playhead.trackEvent("playlist_exported", {
          format,
          tracks: result.exportedTrackCount,
          skipped_tracks: result.skippedTrackCount,
        });
      } catch (error) {
        showSimpleActionToast(getErrorMessage(error, "Failed to export playlist."), "error");
      }
    },
    [],
  );

  const importPlaylist = useCallback(async () => {
    try {
      const result = await window.playhead.importPlaylist();
      if (result.canceled) return;

      const indexes = createTrackMatchIndexes(allPlayableTracksById);
      let nextState = library;
      let importedPlaylistCount = 0;
      let importedTrackCount = 0;
      let unmatchedTrackCount = 0;

      for (const importedPlaylist of result.playlists) {
        const matchedTrackIds: string[] = [];
        const seenTrackIds = new Set<string>();

        for (const importedTrack of importedPlaylist.tracks) {
          const trackId = findImportedTrackId(importedTrack, indexes);
          if (!trackId) {
            unmatchedTrackCount += 1;
            continue;
          }
          if (seenTrackIds.has(trackId)) continue;
          seenTrackIds.add(trackId);
          matchedTrackIds.push(trackId);
        }

        if (matchedTrackIds.length === 0) continue;

        const playlist = createPlaylist(nextState.playlists, importedPlaylist.name);
        nextState = {
          ...nextState,
          playlists: [...nextState.playlists, { ...playlist, trackIds: matchedTrackIds }],
          selectedSource: { type: "playlist", id: playlist.id },
        };
        importedPlaylistCount += 1;
        importedTrackCount += matchedTrackIds.length;
      }

      if (importedPlaylistCount === 0) {
        const message =
          unmatchedTrackCount > 0
            ? "No imported tracks matched your Playhead library."
            : "No playlists found in that file.";
        showSimpleActionToast(message, "error");
        return;
      }

      await persistLibrary(nextState);
      const skippedDetail = unmatchedTrackCount > 0 ? ` ${unmatchedTrackCount} unmatched.` : "";
      showSimpleActionToast(
        `Imported ${importedPlaylistCount} ${importedPlaylistCount === 1 ? "playlist" : "playlists"} with ${importedTrackCount} ${importedTrackCount === 1 ? "track" : "tracks"}.${skippedDetail}`,
      );
      window.playhead.trackEvent("playlist_imported", {
        format: result.format || "unknown",
        playlists: importedPlaylistCount,
        tracks: importedTrackCount,
        unmatched_tracks: unmatchedTrackCount,
      });
    } catch (error) {
      showSimpleActionToast(getErrorMessage(error, "Failed to import playlist."), "error");
    }
  }, [allPlayableTracksById, library, persistLibrary]);

  const reorderTrack = useCallback(
    async (trackIds: string[], targetTrackId: string, edge: "before" | "after" = "before") => {
      if (trackIds.includes(targetTrackId)) return;

      const source = library.selectedSource;
      if (!source) return;
      const uniqueTrackIds = Array.from(new Set(trackIds));
      const uniqueTrackIdSet = new Set(uniqueTrackIds);
      if (uniqueTrackIds.length === 0) return;

      if (source.type === "folder") {
        const folder = library.folders.find((item) => item.id === source.id);
        if (!folder) return;
        const trackIdsToMove = folder.trackIds.filter((trackId) => uniqueTrackIdSet.has(trackId));
        if (trackIdsToMove.length === 0) return;
        const targetIndex = folder.trackIds.indexOf(targetTrackId);
        if (targetIndex === -1) return;
        const nextTrackIds =
          trackIdsToMove.length === 1
            ? moveItem(
                folder.trackIds,
                folder.trackIds.indexOf(trackIdsToMove[0]),
                edge === "after" ? targetIndex + 1 : targetIndex,
              )
            : moveItemsBeforeOrAfter(folder.trackIds, trackIdsToMove, targetTrackId, edge);

        await persistLibrary({
          ...library,
          folders: library.folders.map((item) =>
            item.id === folder.id ? { ...item, trackIds: nextTrackIds } : item,
          ),
        });
        return;
      }

      const playlist = library.playlists.find((item) => item.id === source.id);
      if (!playlist) return;
      const trackIdsToMove = playlist.trackIds.filter((trackId) => uniqueTrackIdSet.has(trackId));
      if (trackIdsToMove.length === 0) return;
      const targetIndex = playlist.trackIds.indexOf(targetTrackId);
      if (targetIndex === -1) return;
      const nextTrackIds =
        trackIdsToMove.length === 1
          ? moveItem(
              playlist.trackIds,
              playlist.trackIds.indexOf(trackIdsToMove[0]),
              edge === "after" ? targetIndex + 1 : targetIndex,
            )
          : moveItemsBeforeOrAfter(playlist.trackIds, trackIdsToMove, targetTrackId, edge);
      const now = new Date().toISOString();

      await persistLibrary({
        ...library,
        playlists: library.playlists.map((item) =>
          item.id === playlist.id ? { ...item, trackIds: nextTrackIds, updatedAt: now } : item,
        ),
      });
    },
    [library, persistLibrary],
  );

  const togglePlayback = useCallback(async () => {
    const wavesurfer = wavesurferRef.current;
    if (!wavesurfer) return;

    if (!activeTrackId) {
      const selectedTrack = selectedTrackIds[0] ? allPlayableTracksById[selectedTrackIds[0]] : null;
      const nextTrack = activeTrack || selectedTrack || tracks[0];
      if (nextTrack) await selectTrack(nextTrack, true);
      return;
    }

    if (loadedTrackIdRef.current !== activeTrackId) {
      const activeTrack = allPlayableTracksById[activeTrackId];
      if (activeTrack) await selectTrack(activeTrack, true);
      return;
    }

    try {
      await wavesurfer.playPause();
    } catch (error) {
      if (activeTrack && !isSoundCloudTrack(activeTrack) && !playbackStatusRef.current.copied) {
        recoverPlaybackRef.current(activeTrack, wavesurfer.getCurrentTime(), true);
      } else {
        loadedTrackIdRef.current = null;
        setIsPlaying(false);
        setPlaybackError(playbackFailure(error));
      }
    }
  }, [activeTrack, activeTrackId, allPlayableTracksById, selectTrack, selectedTrackIds, tracks]);

  const setPlayerVolume = useCallback((nextVolume: number) => {
    const baseVolume = volumeControllerRef.current?.setBaseVolume(nextVolume) ?? 1;
    volumeRef.current = baseVolume;
    setVolume(baseVolume);
  }, []);

  const seekToLyric = useCallback(
    (time: number) => {
      const wavesurfer = wavesurferRef.current;
      if (!wavesurfer) return;
      wavesurfer.setTime(clamp(time, 0, wavesurfer.getDuration() || 0));
      playbackClock.setTime(wavesurfer.getCurrentTime());
    },
    [playbackClock],
  );

  const closeLyrics = useCallback(() => {
    setLyricsOpen(false);
    document.querySelector<HTMLButtonElement>('button[aria-controls="lyrics-panel"]')?.focus();
  }, []);

  const seekBy = useCallback(
    (offset: number) => {
      const wavesurfer = wavesurferRef.current;
      if (!wavesurfer) return;

      const nextTime = clamp(
        wavesurfer.getCurrentTime() + offset,
        0,
        wavesurfer.getDuration() || Number.POSITIVE_INFINITY,
      );
      wavesurfer.setTime(nextTime);
      playbackClock.setTime(wavesurfer.getCurrentTime());
    },
    [playbackClock],
  );

  const volumeBoostEnabled = library.settings.playback.volumeBoostEnabled;
  const maxVolume = volumeBoostEnabled && isAudioGraphActive ? boostedMaxVolume : 1;
  const limiterActive = useLimiterActivity(
    () => audioEngineRef.current?.getLimiterReduction() ?? 0,
    isPlaying && isAudioGraphActive,
  );

  const equalizer = useMemo(
    () => normalizeEqualizerSettings(library.settings.playback.equalizer),
    [library.settings.playback.equalizer],
  );
  const levelMeters = useMemo(
    () => normalizeLevelMeterSettings(library.settings.session.levelMeters),
    [library.settings.session.levelMeters],
  );

  const setMeteringEnabled = useCallback((enabled: boolean) => {
    const engine = audioEngineRef.current;
    if (!engine) return;
    const playback = libraryRef.current.settings.playback;
    engine.setProcessingEnabled(
      normalizeEqualizerSettings(playback.equalizer).enabled || playback.volumeBoostEnabled,
    );
    void engine.setMeteringEnabled(enabled);
    setIsAudioGraphActive(engine.isActive());
  }, []);

  const readLevels = useCallback(
    (target: ChannelLevels) => audioEngineRef.current?.readLevels(target) ?? false,
    [],
  );

  const toggleLevelMeters = useCallback(() => {
    const session = libraryRef.current.settings.session;
    persistSessionSettings({
      ...session,
      levelMeters: { open: !normalizeLevelMeterSettings(session.levelMeters).open },
    });
  }, [persistSessionSettings]);

  useEffect(() => {
    if (!isWaveformEngineReady) return;
    if (volumeBoostEnabled) audioEngineRef.current?.activate();
    setIsAudioGraphActive(audioEngineRef.current?.isActive() ?? false);
    const baseVolume = volumeControllerRef.current?.setMaxVolume(maxVolume) ?? 1;
    volumeRef.current = baseVolume;
    setVolume(baseVolume);
  }, [isWaveformEngineReady, maxVolume, volumeBoostEnabled]);

  useEffect(() => {
    if (!isWaveformEngineReady) return;
    const engine = audioEngineRef.current;
    if (equalizer.enabled) engine?.activate();
    setIsAudioGraphActive(engine?.isActive() ?? false);
    engine?.setEqualizer(getActiveEqualizerGains(equalizer));
    engine?.setProcessingEnabled(equalizer.enabled || volumeBoostEnabled);
  }, [equalizer, isWaveformEngineReady, volumeBoostEnabled]);

  const previewEqualizer = useCallback((nextEqualizer: EqualizerSettings) => {
    const engine = audioEngineRef.current;
    if (nextEqualizer.enabled) {
      engine?.activate();
      engine?.setProcessingEnabled(true);
    }
    setIsAudioGraphActive(engine?.isActive() ?? false);
    engine?.setEqualizer(getActiveEqualizerGains(nextEqualizer));
  }, []);

  const changeEqualizer = useCallback((nextEqualizer: EqualizerSettings) => {
    // Pointer previews do not save. Commit once on release (or each keyboard edit),
    // so closing the app immediately after an edit cannot discard a pending debounce.
    const current = libraryRef.current;
    const nextState = {
      ...current,
      settings: {
        ...current.settings,
        playback: { ...current.settings.playback, equalizer: nextEqualizer },
      },
    };
    libraryRef.current = nextState;
    setLibrary(nextState);
    void window.playhead.saveLibraryState(nextState).catch((error) => {
      console.error("Could not save equalizer settings", error);
    });
  }, []);

  const changeVolumeBy = useCallback(
    (offset: number) => {
      setPlayerVolume((volumeControllerRef.current?.getBaseVolume() ?? volumeRef.current) + offset);
    },
    [setPlayerVolume],
  );

  useEffect(() => {
    const abortController = new AbortController();
    const controller = volumeControllerRef.current;

    if (!controller) return () => abortController.abort();
    if (!activeTrack || !library.settings.playback.normalizeVolume || isLoadingTrack) {
      controller.setNormalizationGain(1, activeTrack && !isLoadingTrack ? 160 : 0);
      return () => abortController.abort();
    }

    const maxGainDb = volumeBoostEnabled ? volumeNormalizationBoostedMaxGainDb : undefined;
    controller.setNormalizationGain(1);
    void (async () => {
      const cachedGain = await getCachedTrackNormalizationGain(activeTrack, maxGainDb);
      if (abortController.signal.aborted) return;
      if (cachedGain !== null) {
        controller.setNormalizationGain(cachedGain, 160);
        return;
      }

      const gain = await analyzeTrackNormalizationGain(
        activeTrack,
        abortController.signal,
        maxGainDb,
      );
      if (abortController.signal.aborted) return;
      controller.setNormalizationGain(gain, 240);
    })();

    return () => abortController.abort();
  }, [activeTrack, isLoadingTrack, library.settings.playback.normalizeVolume, volumeBoostEnabled]);

  const selectTrackInList = useCallback(
    (track: LibraryTrack, event?: React.MouseEvent<HTMLDivElement>) => {
      const isRangeSelection = Boolean(event?.shiftKey);
      const isToggleSelection = Boolean(event?.metaKey || event?.ctrlKey);

      if (isRangeSelection) {
        const anchorTrackId = selectionAnchorTrackIdRef.current || selectedTrackIds[0] || track.id;
        const anchorIndex = tracks.findIndex((item) => item.id === anchorTrackId);
        const targetIndex = tracks.findIndex((item) => item.id === track.id);

        if (anchorIndex !== -1 && targetIndex !== -1) {
          const start = Math.min(anchorIndex, targetIndex);
          const end = Math.max(anchorIndex, targetIndex);
          setSelectedTrackIds(tracks.slice(start, end + 1).map((item) => item.id));
          return;
        }
      }

      if (isToggleSelection) {
        selectionAnchorTrackIdRef.current = track.id;
        setSelectedTrackIds((current) =>
          current.includes(track.id)
            ? current.filter((trackId) => trackId !== track.id)
            : [...current, track.id],
        );
        return;
      }

      selectionAnchorTrackIdRef.current = track.id;
      setSelectedTrackIds([track.id]);
    },
    [selectedTrackIds, tracks],
  );

  const selectAdjacentTrackInList = useCallback(
    (direction: 1 | -1, step = 1) => {
      if (tracks.length === 0) return;

      const selectedTrackId = selectedTrackIds[0] || null;
      let currentIndex = selectedTrackId
        ? tracks.findIndex((track) => track.id === selectedTrackId)
        : -1;

      if (currentIndex === -1 && activeTrackId) {
        currentIndex = tracks.findIndex((track) => track.id === activeTrackId);
      }

      const nextIndex =
        currentIndex === -1
          ? direction === 1
            ? 0
            : tracks.length - 1
          : clamp(currentIndex + direction * step, 0, tracks.length - 1);
      const nextTrack = tracks[nextIndex];
      selectionAnchorTrackIdRef.current = nextTrack.id;
      setSelectedTrackIds([nextTrack.id]);
      setScrollToTrackId(nextTrack.id, "nearest");
    },
    [activeTrackId, selectedTrackIds, tracks, setScrollToTrackId],
  );

  const playSelectedTrack = useCallback(() => {
    const selectedTrack = selectedTrackIds[0] ? allPlayableTracksById[selectedTrackIds[0]] : null;
    if (selectedTrack) void selectTrack(selectedTrack, true, undefined, true, "source");
  }, [allPlayableTracksById, selectTrack, selectedTrackIds]);

  const selectLibrarySource = useCallback((source: LibraryState["selectedSource"]) => {
    setLyricsOpen(false);
    setSelectedLibraryBrowserItemIds([]);
    libraryBrowserSelectionAnchorIdRef.current = null;
    setLibrary((current) => {
      const nextState = { ...current, selectedSource: source };
      libraryRef.current = nextState;
      void window.playhead.saveLibrarySelectedSource(source);
      return nextState;
    });
  }, []);

  const revealPlayingTrack = useCallback(() => {
    if (!activeTrack) return;
    const source = getPlayingTrackSource(library, activeTrack, soundcloudTracksByCollection);
    selectLibrarySource(source);
    setSelectedTrackIds([activeTrack.id]);
    selectionAnchorTrackIdRef.current = activeTrack.id;
    setScrollToTrackId(activeTrack.id, "center", true);
  }, [activeTrack, library, selectLibrarySource, soundcloudTracksByCollection, setScrollToTrackId]);

  const selectSoundCloudSource = useCallback(
    async (collectionId: string) => {
      selectLibrarySource({ type: "soundcloud", id: collectionId });
      await loadSoundCloudCollectionTracks(collectionId);
    },
    [loadSoundCloudCollectionTracks, selectLibrarySource],
  );

  const deleteSoundCloudPlaylist = useCallback(
    async (collection: SoundCloudCollection) => {
      try {
        await window.playhead.deleteSoundCloudPlaylist(collection.id);
      } catch (error) {
        showSimpleActionToast(
          getErrorMessage(error, "Could not delete the SoundCloud playlist."),
          "error",
        );
        return;
      }
      setSoundCloudCollections((current) => current.filter((item) => item.id !== collection.id));
      setSoundCloudTracksByCollection((current) => {
        const next = { ...current };
        delete next[collection.id];
        return next;
      });
      const source = libraryRef.current.selectedSource;
      if (source?.type === "soundcloud" && source.id === collection.id) {
        const folder = libraryRef.current.folders[0];
        selectLibrarySource(folder ? { type: "folder", id: folder.id } : null);
      }
      showSimpleActionToast(`Deleted ${collection.title} from SoundCloud`);
    },
    [selectLibrarySource],
  );

  const selectLibraryBrowserItem = useCallback(
    (itemId: string, orderedItemIds: string[], event?: React.MouseEvent<HTMLDivElement>) => {
      const isRangeSelection = Boolean(event?.shiftKey);
      const isToggleSelection = Boolean(event?.metaKey || event?.ctrlKey);

      if (isRangeSelection) {
        const anchorItemId =
          libraryBrowserSelectionAnchorIdRef.current || selectedLibraryBrowserItemIds[0] || itemId;
        const anchorIndex = orderedItemIds.indexOf(anchorItemId);
        const targetIndex = orderedItemIds.indexOf(itemId);

        if (anchorIndex !== -1 && targetIndex !== -1) {
          const start = Math.min(anchorIndex, targetIndex);
          const end = Math.max(anchorIndex, targetIndex);
          setSelectedLibraryBrowserItemIds(orderedItemIds.slice(start, end + 1));
          return;
        }
      }

      if (isToggleSelection) {
        libraryBrowserSelectionAnchorIdRef.current = itemId;
        setSelectedLibraryBrowserItemIds((current) =>
          current.includes(itemId)
            ? current.filter((currentItemId) => currentItemId !== itemId)
            : [...current, itemId],
        );
        return;
      }

      libraryBrowserSelectionAnchorIdRef.current = itemId;
      setSelectedLibraryBrowserItemIds([itemId]);
    },
    [selectedLibraryBrowserItemIds],
  );

  const selectAllVisibleItems = useCallback(() => {
    const source = library.selectedSource;
    if (!source) return;

    if (source.type === "library-artists") {
      const artistIds = libraryArtists.map((artist) => artist.id);
      setSelectedLibraryBrowserItemIds(artistIds);
      libraryBrowserSelectionAnchorIdRef.current = artistIds[0] || null;
      return;
    }

    if (source.type === "library-albums") {
      const albumIds = libraryAlbums.map((album) => album.id);
      setSelectedLibraryBrowserItemIds(albumIds);
      libraryBrowserSelectionAnchorIdRef.current = albumIds[0] || null;
      return;
    }

    if (tracks.length === 0) return;
    const trackIds = tracks.map((track) => track.id);
    setSelectedTrackIds(trackIds);
    selectionAnchorTrackIdRef.current = trackIds[0] || null;
  }, [library.selectedSource, libraryAlbums, libraryArtists, tracks]);

  const backFromLibraryDetail = useCallback(() => {
    if (library.settings.library.mode !== "library") return;
    if (library.selectedSource?.type === "library-artist") {
      selectLibrarySource({ type: "library-artists" });
    }
    if (library.selectedSource?.type === "library-album") {
      selectLibrarySource({ type: "library-albums" });
    }
  }, [library.selectedSource, library.settings.library.mode, selectLibrarySource]);

  const viewTrackArtist = useCallback(
    (track: LibraryTrack) => {
      if (library.settings.library.mode !== "library") return;
      selectLibrarySource({ type: "library-artist", id: getTrackArtistId(track) });
    },
    [library.settings.library.mode, selectLibrarySource],
  );

  const viewTrackAlbum = useCallback(
    (track: LibraryTrack) => {
      if (library.settings.library.mode !== "library") return;
      selectLibrarySource({ type: "library-album", id: getTrackAlbumId(track) });
    },
    [library.settings.library.mode, selectLibrarySource],
  );

  const toggleSelectedTrackFavorite = useCallback(() => {
    const selectedTrackId = selectedTrackIds[0];
    if (selectedTrackId) void toggleFavoriteTrack(selectedTrackId);
  }, [selectedTrackIds, toggleFavoriteTrack]);

  const rememberTrackPosition = useCallback(
    (trackId: string, time: number) => {
      if (!library.settings.playback.rememberTrackPositions) return;

      persistSessionSettings({
        ...library.settings.session,
        activeTrackId: trackId,
        selectedTrackIds,
        trackPositions: withTrackPosition(library.settings.session.trackPositions, trackId, time),
      });
    },
    [
      library.settings.playback.rememberTrackPositions,
      library.settings.session,
      persistSessionSettings,
      selectedTrackIds,
    ],
  );

  const clearTrackPosition = useCallback(
    (trackId: string) => {
      if (!library.settings.playback.rememberTrackPositions) return;
      const nextPositions = { ...library.settings.session.trackPositions };
      delete nextPositions[trackId];
      persistSessionSettings({
        ...library.settings.session,
        trackPositions: nextPositions,
      });
    },
    [
      library.settings.playback.rememberTrackPositions,
      library.settings.session,
      persistSessionSettings,
    ],
  );

  const playAdjacentTrack = useCallback(
    (direction: 1 | -1) => {
      const visibleQueueItems = getVisibleQueueItems(
        library.settings.session.queue,
        shuffleEnabled,
      );
      if (visibleQueueItems.length > 0) {
        let currentIndex = getActiveQueueIndex(library.settings.session.queue, shuffleEnabled);
        if (currentIndex === -1 && activeTrackId) {
          currentIndex = visibleQueueItems.findIndex((item) => item.trackId === activeTrackId);
        }

        const nextIndex =
          currentIndex === -1
            ? direction === -1
              ? visibleQueueItems.length - 1
              : 0
            : (currentIndex + direction + visibleQueueItems.length) % visibleQueueItems.length;
        const nextItem = visibleQueueItems[nextIndex];
        const nextTrack = nextItem ? allPlayableTracksById[nextItem.trackId] : null;
        if (!nextTrack) return;

        persistSessionSettings({
          ...library.settings.session,
          queue: { ...library.settings.session.queue, activeItemId: nextItem.id },
        });
        setScrollToTrackId(nextTrack.id);
        void selectTrack(nextTrack, true, 0, false, "preserve", nextItem.id);
        return;
      }

      if (tracks.length === 0) return;

      const selectedTrackId = selectedTrackIds[0] || null;
      let currentIndex = activeTrackId
        ? tracks.findIndex((track) => track.id === activeTrackId)
        : -1;

      if (currentIndex === -1 && selectedTrackId) {
        currentIndex = tracks.findIndex((track) => track.id === selectedTrackId);
      }

      const nextIndex =
        currentIndex === -1
          ? direction === -1
            ? tracks.length - 1
            : 0
          : (currentIndex + direction + tracks.length) % tracks.length;

      const nextTrack = tracks[nextIndex];
      setScrollToTrackId(nextTrack.id);
      void selectTrack(nextTrack, true, 0, false);
    },
    [
      activeTrackId,
      library.settings.session,
      allPlayableTracksById,
      persistSessionSettings,
      selectTrack,
      selectedTrackIds,
      shuffleEnabled,
      tracks,
      setScrollToTrackId,
    ],
  );

  const continueSoundCloudStation = useCallback(
    async (seed: LibraryTrack) => {
      if (!seed.soundcloud) return;
      let related: LibraryTrack[];
      try {
        related = await window.playhead.getSoundCloudRelatedTracks(
          seed.soundcloud.id,
          seed.soundcloud.urn,
        );
      } catch {
        related = [];
      }
      // The user may have started something else while related tracks were loading.
      if (activeTrackIdRef.current !== seed.id || isPlayingRef.current) return;
      const queue = libraryRef.current.settings.session.queue;
      const queued = new Set([...queue.items, ...queue.shuffledItems].map((item) => item.trackId));
      const fresh = related
        .filter((track) => !queued.has(track.id) && track.id !== seed.id)
        .slice(0, stationBatchSize);
      if (fresh.length === 0) {
        showSimpleActionToast("No similar SoundCloud tracks to continue with.", "info");
        return;
      }
      setSoundCloudTracksByCollection((current) => ({
        ...current,
        [soundcloudStationCollectionId]: [
          ...(current[soundcloudStationCollectionId] || []),
          ...fresh,
        ],
      }));
      soundcloudTracksRef.current = {
        ...soundcloudTracksRef.current,
        ...Object.fromEntries(fresh.map((track) => [track.id, track])),
      };
      const extended = addTracksToQueue(
        queue,
        fresh.map((track) => track.id),
        null,
        "after",
        shuffleEnabled,
      );
      const existingItemIds = new Set(
        [...queue.items, ...queue.shuffledItems].map((item) => item.id),
      );
      const firstNew = getVisibleQueueItems(extended, shuffleEnabled).find(
        (item) => !existingItemIds.has(item.id),
      );
      if (!firstNew) return;
      const nextTrack = fresh.find((track) => track.id === firstNew.trackId) || fresh[0];
      setScrollToTrackId(nextTrack.id);
      await selectTrack(nextTrack, true, 0, true, "preserve", firstNew.id, false, {
        ...extended,
        activeItemId: firstNew.id,
      });
    },
    [selectTrack, setScrollToTrackId, shuffleEnabled],
  );

  const playNextTrackOnEnd = useCallback(() => {
    if (!activeTrackId) return false;

    if (repeatMode === "one") {
      const wavesurfer = wavesurferRef.current;
      if (!wavesurfer) return false;
      wavesurfer.setTime(0);
      void wavesurfer.play();
      return true;
    }

    const visibleQueueItems = getVisibleQueueItems(library.settings.session.queue, shuffleEnabled);
    if (visibleQueueItems.length > 0) {
      const currentIndex = getActiveQueueIndex(library.settings.session.queue, shuffleEnabled);
      const nextItem =
        currentIndex >= 0
          ? visibleQueueItems[currentIndex + 1] ||
            (repeatMode === "all" ? visibleQueueItems[0] : null)
          : visibleQueueItems[0] || null;
      const nextTrack = nextItem ? allPlayableTracksById[nextItem.trackId] : null;
      if (!nextTrack || !nextItem) {
        if (activeTrack?.soundcloud && library.settings.soundcloud.stationEnabled)
          void continueSoundCloudStation(activeTrack);
        return false;
      }

      persistSessionSettings({
        ...library.settings.session,
        queue: { ...library.settings.session.queue, activeItemId: nextItem.id },
      });
      setScrollToTrackId(nextTrack.id);
      void selectTrack(nextTrack, true, 0, true, "preserve", nextItem.id);
      return true;
    }

    const currentIndex = tracks.findIndex((track) => track.id === activeTrackId);
    let nextTrack = currentIndex >= 0 ? tracks[currentIndex + 1] : null;
    if (!nextTrack && repeatMode === "all") nextTrack = tracks[0] || null;
    if (!nextTrack) {
      if (activeTrack?.soundcloud && library.settings.soundcloud.stationEnabled)
        void continueSoundCloudStation(activeTrack);
      return false;
    }

    setScrollToTrackId(nextTrack.id);
    void selectTrack(nextTrack, true, 0);
    return true;
  }, [
    activeTrack,
    activeTrackId,
    continueSoundCloudStation,
    library.settings.session,
    library.settings.soundcloud.stationEnabled,
    allPlayableTracksById,
    persistSessionSettings,
    repeatMode,
    selectTrack,
    shuffleEnabled,
    tracks,
    setScrollToTrackId,
  ]);

  useEffect(() => {
    libraryRef.current = library;
    activeTrackIdRef.current = activeTrackId;
    activeTrackRef.current = activeTrack;
    lastfmSettingsRef.current = library.settings.lastfm;
    rememberTrackPositionRef.current = rememberTrackPosition;
    clearTrackPositionRef.current = clearTrackPosition;
  }, [
    activeTrack,
    activeTrackId,
    clearTrackPosition,
    library,
    library.settings.lastfm,
    rememberTrackPosition,
  ]);

  useEffect(() => {
    playAdjacentTrackRef.current = () => playAdjacentTrack(1);
  }, [playAdjacentTrack]);

  useEffect(() => {
    if (didLoadLibraryRef.current) return;
    didLoadLibraryRef.current = true;

    void window.playhead.getLibraryState().then((state) => {
      const nextState = normalizeSourceForMode(state);
      libraryRef.current = nextState;
      setLibrary(nextState);
      setShuffleEnabled(nextState.settings.session.shuffleEnabled);
      setRepeatMode(nextState.settings.session.repeatMode);
      void window.playhead.watchLibraryFolders(
        nextState.settings.library.watchFolders ? nextState.folders : [],
        nextState.settings.library.enabledAudioExtensions,
      );
      if (nextState !== state) void window.playhead.saveLibraryState(nextState);
      const needsMetadataRefresh = nextState.folders.some(
        (folder) => folder.metadataVersion !== libraryTrackMetadataVersion,
      );
      if (nextState.settings.library.rescanOnLaunch || needsMetadataRefresh)
        void rescanLibrary(nextState, { preserveView: true });
    });
  }, [rescanLibrary]);

  useEffect(() => {
    if (didRestoreSessionRef.current || !isWaveformEngineReady) return;
    if (!library.settings.playback.restoreLastSession) return;

    const trackId = library.settings.session.activeTrackId;
    const track = trackId ? allPlayableTracksById[trackId] : null;
    if (!track) return;

    didRestoreSessionRef.current = true;
    setSelectedTrackIds(library.settings.session.selectedTrackIds);
    setScrollToTrackId(track.id);
    void selectTrack(track, false, library.settings.session.trackPositions[track.id] || 0);
  }, [allPlayableTracksById, isWaveformEngineReady, library, selectTrack, setScrollToTrackId]);

  useEffect(() => {
    const onSelectAll = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
      if (event.key.toLowerCase() !== "a") return;

      event.preventDefault();
      selectAllVisibleItems();
    };

    window.addEventListener("keydown", onSelectAll);
    return () => window.removeEventListener("keydown", onSelectAll);
  }, [selectAllVisibleItems]);

  useEffect(() => {
    const canGoBackFromLibraryDetail = () =>
      library.settings.library.mode === "library" &&
      (library.selectedSource?.type === "library-artist" ||
        library.selectedSource?.type === "library-album");

    const onMouseBack = (event: MouseEvent) => {
      if (event.button !== 3) return;
      if (!canGoBackFromLibraryDetail()) return;

      event.preventDefault();
      backFromLibraryDetail();
    };

    const onTrackpadBack = (event: WheelEvent) => {
      if (!canGoBackFromLibraryDetail()) return;
      if (event.deltaX >= -45) return;
      if (Math.abs(event.deltaX) < Math.abs(event.deltaY) * 1.5) return;

      const now = Date.now();
      if (now - lastLibraryBackGestureAtRef.current < 700) return;
      lastLibraryBackGestureAtRef.current = now;

      event.preventDefault();
      backFromLibraryDetail();
    };

    window.addEventListener("mousedown", onMouseBack);
    window.addEventListener("auxclick", onMouseBack);
    window.addEventListener("wheel", onTrackpadBack, { passive: false });
    return () => {
      window.removeEventListener("mousedown", onMouseBack);
      window.removeEventListener("auxclick", onMouseBack);
      window.removeEventListener("wheel", onTrackpadBack);
    };
  }, [backFromLibraryDetail, library.selectedSource, library.settings.library.mode]);

  useEffect(() => {
    const pending = new Set<string>();
    const running = new Set<string>();
    let disposed = false;
    const scanChangedFolder = async (folderId: string) => {
      if (running.has(folderId)) {
        pending.add(folderId);
        return;
      }
      running.add(folderId);
      try {
        do {
          pending.delete(folderId);
          const current = libraryRef.current;
          const folder = current.folders.find((item) => item.id === folderId);
          if (!folder || disposed) return;
          const scanned = await window.playhead.scanFolder(
            folder,
            current.settings.library.enabledAudioExtensions,
          );
          if (!scanned || disposed) return;
          const latest = libraryRef.current;
          await persistLibrary(
            mergeScannedLibraryState(latest, mergeScannedFolder(latest, scanned), [
              scanned.folder.id,
            ]),
          );
        } while (pending.has(folderId) && !disposed);
      } catch (error) {
        setError(getErrorMessage(error, "Could not rescan changed folder."));
      } finally {
        running.delete(folderId);
      }
    };
    const unsubscribe = window.playhead.onFolderChanged((id) => {
      void scanChangedFolder(id);
    });
    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [persistLibrary]);

  useEffect(() => {
    void window.playhead.getUpdateState().then(setUpdateState);
    return window.playhead.onUpdateStateChanged(setUpdateState);
  }, []);

  useEffect(() => {
    void window.playhead.getAppVersion().then((version) => {
      const lastSeenVersion = localStorage.getItem(updateMessageLastSeenVersionKey);
      const didJustUpdate = Boolean(lastSeenVersion && lastSeenVersion !== version);
      const message = updateMessagesByVersion[version];
      if (!didJustUpdate || !message) {
        markUpdateMessageVersionSeen(version);
        return;
      }

      const dismissedKey = getUpdateMessageDismissedKey(version);
      if (localStorage.getItem(dismissedKey) === "true") {
        markUpdateMessageVersionSeen(version);
        return;
      }

      setUpdateMessage({ version, message });
    });
  }, []);

  useEffect(() => {
    void window.playhead.getLastfmState().then(setLastfmState);
  }, []);

  useEffect(() => {
    void window.playhead.getSoundCloudState().then(setSoundCloudState);
    return window.playhead.onSoundCloudStateChanged((nextState) => {
      setSoundCloudState(nextState);
      if (nextState.connected) void applySoundCloudActivationDefaults();
    });
  }, [applySoundCloudActivationDefaults]);

  useEffect(() => {
    if (!soundcloudState.connected || !library.settings.soundcloud.likeSyncEnabled) {
      setSoundCloudLikedTrackIds(new Set());
      return;
    }
    let cancelled = false;
    void window.playhead
      .getSoundCloudCollectionTracks("liked-tracks")
      .then((tracks) => {
        if (!cancelled) setSoundCloudLikedTrackIds(new Set(tracks.map((track) => track.id)));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [library.settings.soundcloud.likeSyncEnabled, soundcloudState.connected]);

  useEffect(() => {
    void loadSoundCloudCollections();
  }, [
    library.settings.soundcloud.enabled,
    library.settings.soundcloud.visibleCollections,
    loadSoundCloudCollections,
  ]);

  useEffect(() => {
    const source = library.selectedSource;
    if (source?.type !== "soundcloud" || !source.id) return;
    if (!library.settings.soundcloud.enabled || !soundcloudState.connected) return;

    void loadSoundCloudCollectionTracks(source.id);
  }, [
    library.selectedSource,
    library.settings.soundcloud.enabled,
    loadSoundCloudCollectionTracks,
    soundcloudState.connected,
  ]);

  useEffect(() => {
    playNextTrackOnEndRef.current = playNextTrackOnEnd;
  }, [playNextTrackOnEnd]);

  useEffect(() => {
    if (!waveformElement || wavesurferRef.current) return;

    const styles = getComputedStyle(document.documentElement);
    const wavesurfer = WaveSurfer.create({
      container: waveformElement,
      height: "auto",
      width: "100%",
      backend: "MediaElement",
      waveColor: styles.getPropertyValue("--text-secondary").trim() || "#a6a6a2",
      progressColor: styles.getPropertyValue("--foreground").trim() || "#ffffff",
      cursorColor: styles.getPropertyValue("--primary").trim() || "#ffff00",
      cursorWidth: 2,
      normalize: true,
      dragToSeek: true,
      sampleRate: 16000,
    });
    wavesurferRef.current = wavesurfer;
    const restoreProgressRendering = limitWaveformProgressRendering(wavesurfer.getRenderer());
    audioEngineRef.current = new PlaybackAudioEngine(wavesurfer.getMediaElement());
    volumeControllerRef.current?.setBaseVolume(volumeRef.current);
    setIsWaveformEngineReady(true);
    const unsubscribers = [
      wavesurfer.on("ready", (nextDuration) => {
        setDuration(nextDuration || 0);
        playbackClock.setTime(wavesurfer.getCurrentTime());
        updateMediaPosition(nextDuration, wavesurfer.getCurrentTime());
      }),
      wavesurfer.on("timeupdate", (time) => {
        playbackClock.setTime(time);
        const trackId = activeTrackIdRef.current;
        if (trackId && Date.now() - lastPositionSaveRef.current >= 5000) {
          lastPositionSaveRef.current = Date.now();
          rememberTrackPositionRef.current(trackId, time);
        }
        const session = lastfmPlaybackSessionRef.current;
        const track = activeTrackRef.current;
        if (
          !lastfmSettingsRef.current.scrobblingEnabled ||
          !session ||
          !track ||
          session.trackId !== track.id
        ) {
          return;
        }
        const nextSession = updateLastfmPlaybackProgress(session, time);
        lastfmPlaybackSessionRef.current = nextSession;
        const trackDuration = wavesurfer.getDuration() || track.duration || 0;
        if (!shouldScrobbleLastfmTrack(nextSession, trackDuration)) return;
        lastfmPlaybackSessionRef.current = { ...nextSession, scrobbled: true };
        const payload = toLastfmTrackPayload(
          track,
          Math.floor(nextSession.startedAt / 1000),
          trackDuration,
        );
        if (payload) void window.playhead.scrobbleLastfmTrack(payload).then(setLastfmState);
      }),
      wavesurfer.on("seeking", (time) => {
        playbackClock.setTime(time);
        updateMediaPosition(wavesurfer.getDuration(), time);
        const session = lastfmPlaybackSessionRef.current;
        if (session) lastfmPlaybackSessionRef.current = { ...session, lastTime: time };
      }),
      wavesurfer.on("play", () => {
        isPlayingRef.current = true;
        setIsPlaying(true);
        updateMediaPosition(wavesurfer.getDuration(), wavesurfer.getCurrentTime());
        const track = activeTrackRef.current;
        if (!track || !lastfmSettingsRef.current.scrobblingEnabled) return;
        if (lastfmPlaybackSessionRef.current?.trackId !== track.id) {
          lastfmPlaybackSessionRef.current = createLastfmPlaybackSession(
            track.id,
            Date.now(),
            wavesurfer.getCurrentTime(),
          );
        }
        if (lastfmNowPlayingTrackIdRef.current === track.id) return;
        const payload = toLastfmTrackPayload(track, undefined, wavesurfer.getDuration());
        if (!payload) return;
        lastfmNowPlayingTrackIdRef.current = track.id;
        void window.playhead.updateLastfmNowPlaying(payload).then(setLastfmState);
      }),
      wavesurfer.on("pause", () => {
        isPlayingRef.current = false;
        setIsPlaying(false);
        updateMediaPosition(wavesurfer.getDuration(), wavesurfer.getCurrentTime());
      }),
      wavesurfer.on("finish", () => {
        // Ignore a repeated/stale ended event while the next source is loading or playing.
        // The HTML media element is authoritative; React may already show the next track.
        if (
          !wavesurfer.getMediaElement().ended ||
          playbackStatusRef.current.loading ||
          !loadedTrackIdRef.current ||
          loadedTrackIdRef.current !== activeTrackIdRef.current
        )
          return;
        if (activeTrackIdRef.current) clearTrackPositionRef.current(activeTrackIdRef.current);
        lastfmPlaybackSessionRef.current = null;
        if (!playNextTrackOnEndRef.current()) setIsPlaying(false);
      }),
      wavesurfer.on("error", (error) => {
        if (playbackStatusRef.current.loading || error?.name === "AbortError") return;
        const track = activeTrackRef.current;
        if (!track || loadedTrackIdRef.current !== track.id) return;
        const time = wavesurfer.getCurrentTime();
        const autoplay = isPlayingRef.current;
        loadedTrackIdRef.current = null;
        wavesurfer.pause();
        setIsPlaying(false);
        if (!isSoundCloudTrack(track) && !playbackStatusRef.current.copied) {
          recoverPlaybackRef.current(track, time, autoplay);
        } else {
          setPlaybackError(playbackFailure(error));
          setIsLoadingTrack(false);
        }
      }),
    ];

    return () => {
      playbackAbortRef.current?.abort();
      destroyHls();
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      restoreProgressRendering();
      audioEngineRef.current?.dispose();
      audioEngineRef.current = null;
      setIsAudioGraphActive(false);
      wavesurfer.destroy();
      wavesurferRef.current = null;
      setIsWaveformEngineReady(false);
    };
  }, [destroyHls, playbackClock, waveformElement]);

  const playbackQueue = usePlaybackQueue({
    library,
    tracksById: allPlayableTracksById,
    shuffleEnabled,
    persistSessionSettings,
    selectTrack,
    setSelectedTrackIds,
    setScrollToTrackId,
  });

  usePlayerKeyboardShortcuts({
    playbackSettings: library.settings.playback,
    onToggleQueue: playbackQueue.togglePanel,
    onRevealPlayingTrack: revealPlayingTrack,
    onOpenSearch: () => setIsSearchOpen(true),
    onOpenSettings: () => setIsSettingsOpen(true),
    onTogglePlayback: () => void togglePlayback(),
    onSeekBy: seekBy,
    onChangeVolumeBy: changeVolumeBy,
    onSelectAdjacentTrack: selectAdjacentTrackInList,
    onPlaySelectedTrack: playSelectedTrack,
    onToggleSelectedTrackFavorite: toggleSelectedTrackFavorite,
  });

  useEffect(() => {
    return window.playhead.onMediaCommand((command) => {
      if (command === "play-pause") void togglePlayback();
      if (command === "next") playAdjacentTrack(1);
      if (command === "previous") playAdjacentTrack(-1);
    });
  }, [playAdjacentTrack, togglePlayback]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    navigator.mediaSession.metadata = activeTrack
      ? new MediaMetadata({
          title: activeTrack.title,
          artist: activeTrack.artist,
          album: activeTrack.album || selectedTitle,
          artwork: activeTrack.artwork
            ? [
                {
                  src: getMediaArtworkSrc(activeTrack) || "",
                  sizes: "512x512",
                  type: activeTrack.artwork.mimeType,
                },
              ]
            : undefined,
        })
      : null;
  }, [activeTrack, selectedTitle]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? "playing" : activeTrack ? "paused" : "none";
  }, [activeTrack, isPlaying]);

  // The OS extrapolates the position from the last update, so it only needs refreshing when
  // playback starts, pauses, seeks or the track changes.
  useEffect(() => {
    updateMediaPosition(duration, playbackClock.getTime());
  }, [duration, playbackClock]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    setMediaActionHandler("play", () => {
      if (!isPlaying) void togglePlayback();
    });
    setMediaActionHandler("pause", () => {
      if (isPlaying) void togglePlayback();
    });
    setMediaActionHandler("previoustrack", () => playAdjacentTrack(-1));
    setMediaActionHandler("nexttrack", () => playAdjacentTrack(1));
    setMediaActionHandler("seekto", (details) => {
      const wavesurfer = wavesurferRef.current;
      if (!wavesurfer || typeof details.seekTime !== "number") return;
      wavesurfer.setTime(details.seekTime);
      playbackClock.setTime(wavesurfer.getCurrentTime());
    });
    setMediaActionHandler("seekbackward", (details) => {
      seekBy(-(details.seekOffset || 10));
    });
    setMediaActionHandler("seekforward", (details) => {
      seekBy(details.seekOffset || 10);
    });

    return () => {
      setMediaActionHandler("play", null);
      setMediaActionHandler("pause", null);
      setMediaActionHandler("previoustrack", null);
      setMediaActionHandler("nexttrack", null);
      setMediaActionHandler("seekto", null);
      setMediaActionHandler("seekbackward", null);
      setMediaActionHandler("seekforward", null);
    };
  }, [isPlaying, playAdjacentTrack, playbackClock, seekBy, togglePlayback]);

  const selectedSource = library.selectedSource;
  const selectedSourceScrollKey = getSourceScrollKey(selectedSource);
  const selectedPlaylist =
    selectedSource?.type === "playlist"
      ? library.playlists.find((playlist) => playlist.id === selectedSource.id) || null
      : null;
  const selectedSoundCloudPlaylistId =
    selectedSource?.type === "soundcloud" && selectedSource.id?.startsWith("playlist:")
      ? selectedSource.id
      : null;
  const requestRemoveTracksFromListedPlaylist = (trackIds: string[]) => {
    if (!selectedSoundCloudPlaylistId) {
      requestRemoveTracksFromSelectedPlaylist(trackIds);
      return;
    }
    if (trackIds.length > 1) setPlaylistTrackIdsPendingRemoval(trackIds);
    else void removeTracksFromSoundCloudPlaylist(selectedSoundCloudPlaylistId, trackIds);
  };
  const selectedTag =
    selectedSource?.type === "tag"
      ? (library.tags || []).find((tag) => tag.id === selectedSource.id) || null
      : null;
  const activeTrackSelectedPlaylist =
    activeTrack && selectedPlaylist?.trackIds.includes(activeTrack.id) ? selectedPlaylist : null;
  const activeTrackSelectedTag =
    activeTrack && selectedTag?.trackIds.includes(activeTrack.id) ? selectedTag : null;

  const hasLovedTracks = (library.favoriteTrackIds || []).some(
    (trackId) => library.tracks[trackId],
  );
  const isLibraryEmpty =
    library.folders.length === 0 &&
    library.playlists.length === 0 &&
    !hasLovedTracks &&
    !(library.settings.soundcloud.enabled && soundcloudState.connected);

  return (
    <MotionConfig reducedMotion={reduceMotion ? "always" : "never"}>
      <main
        className={`app-window app-drag h-dvh overflow-hidden bg-transparent text-foreground ${
          reduceMotion ? "reduce-motion" : ""
        }`}
      >
        {scanId && <LibraryScanStatus key={scanId} scanId={scanId} />}
        <section
          className="app-shell app-drag relative flex size-full gap-4 overflow-hidden p-4"
          style={{ "--app-transparency": appTransparency } as React.CSSProperties}
        >
          <div
            className="app-drag relative flex h-full min-h-0 shrink-0 transition-[width] duration-200"
            style={{ width: sidebarWidth }}
          >
            {playbackQueue.panelOpen ? (
              <QueueSidebar
                items={playbackQueue.items}
                tracksById={allPlayableTracksById}
                activeItemId={playbackQueue.activeItemId}
                updateState={updateState}
                onToggleQueue={playbackQueue.togglePanel}
                onOpenSearch={() => setIsSearchOpen(true)}
                onOpenSettings={() => setIsSettingsOpen(true)}
                onInstallUpdate={() => {
                  window.playhead.trackEvent("app_update_install_clicked", {
                    version: updateState.version || "unknown",
                  });
                  void window.playhead.installUpdate();
                }}
                onPlayItem={playbackQueue.playItem}
                onReorderItems={playbackQueue.reorderItems}
                onAddTracks={playbackQueue.addTracks}
                onRemoveItem={playbackQueue.removeItem}
              />
            ) : (
              <Sidebar
                folders={library.folders}
                tracks={library.tracks}
                showSubfolders={library.settings.library.showSubfolders}
                expandedFolderPaths={library.settings.session.expandedFolderPaths}
                libraryMode={library.settings.library.mode}
                artistCount={libraryArtists.length}
                albumCount={libraryAlbums.length}
                trackCount={libraryTrackCount}
                playlists={library.playlists}
                tags={library.tags || []}
                lovedCount={hasLovedTracks ? library.favoriteTrackIds.length : 0}
                selectedSource={library.selectedSource}
                soundcloudEnabled={library.settings.soundcloud.enabled && soundcloudState.connected}
                soundcloudCollections={soundcloudCollections}
                soundcloudLoadingCollectionId={soundcloudLoadingCollectionId}
                sidebarGroupOrder={library.settings.session.sidebarGroupOrder}
                isScanning={isScanning}
                updateState={updateState}
                onAddFolder={addFolder}
                onOpenSearch={() => setIsSearchOpen(true)}
                onOpenSettings={() => setIsSettingsOpen(true)}
                onInstallUpdate={() => {
                  window.playhead.trackEvent("app_update_install_clicked", {
                    version: updateState.version || "unknown",
                  });
                  void window.playhead.installUpdate();
                }}
                onCreatePlaylist={() => setIsCreatePlaylistOpen(true)}
                onImportPlaylist={() => void importPlaylist()}
                onCreateTag={() => setIsCreateTagOpen(true)}
                onSelectSource={selectLibrarySource}
                onSelectSoundCloudSource={(collectionId) =>
                  void selectSoundCloudSource(collectionId)
                }
                onRefreshSoundCloud={() => void loadSoundCloudCollections()}
                onSidebarGroupOrderChange={(sidebarGroupOrder) =>
                  persistSessionSettings({ ...library.settings.session, sidebarGroupOrder })
                }
                onExpandedFolderPathsChange={(expandedFolderPaths) =>
                  persistSessionSettings({ ...library.settings.session, expandedFolderPaths })
                }
                onDropTrackToPlaylist={(trackIds, playlist) =>
                  void addTracksToPlaylist(trackIds, playlist)
                }
                onDropTrackToTag={(trackIds, tag) => void addTracksToTag(trackIds, tag)}
                onCreateSoundCloudPlaylist={() =>
                  setSoundCloudPlaylistDialog({ mode: "create", tracks: [] })
                }
                onRenameSoundCloudPlaylist={(collection) =>
                  setSoundCloudPlaylistDialog({ mode: "rename", collection })
                }
                onDeleteSoundCloudPlaylist={setSoundCloudPlaylistPendingDeletion}
                onDropTrackToSoundCloudPlaylist={(trackIds, playlist, move) =>
                  void addTracksToSoundCloudPlaylist(trackIds, playlist, move)
                }
                onRemoveFolder={(folder) => setFolderPendingRemoval(folder)}
                onExportPlaylist={(playlist, format) => void exportPlaylist(playlist, format)}
                onRenamePlaylist={(playlist) => setRenamingPlaylistId(playlist.id)}
                onDeletePlaylist={(playlist) => {
                  if (playlist.trackIds.length === 0) {
                    void deletePlaylist(playlist.id);
                    return;
                  }
                  setPlaylistPendingDeletion(playlist);
                }}
                onRenameTag={(tag) => setRenamingTagId(tag.id)}
                onDeleteTag={(tag) => {
                  if (tag.trackIds.length === 0) {
                    void deleteTag(tag.id);
                    return;
                  }
                  setTagPendingDeletion(tag);
                }}
                queueOpen={playbackQueue.panelOpen}
                onToggleQueue={playbackQueue.togglePanel}
              />
            )}
          </div>

          <main className="app-drag relative flex min-h-0 min-w-0 flex-1 flex-col gap-[10px]">
            <div
              className="app-drag absolute inset-x-0 top-0 z-40 h-8"
              aria-hidden="true"
              {...topGapWindowDragHandlers}
            />
            {isLibraryEmpty ? (
              <EmptyLibraryState
                isScanning={isScanning}
                libraryMode={library.settings.library.mode}
                onLibraryModeChange={(mode) => void updateLibraryMode(mode)}
                onAddFolder={addFolder}
                onDropFolderPaths={(folderPaths) => void addFolderPaths(folderPaths)}
              />
            ) : (
              <>
                <Player
                  soundcloudComments={
                    soundcloudState.connected && library.settings.soundcloud.commentsEnabled
                      ? {
                          popups: library.settings.soundcloud.commentPopupsEnabled,
                          canPost: true,
                        }
                      : null
                  }
                  onSeek={seekToLyric}
                  playbackError={playbackError}
                  preparingPlayback={preparingPlayback}
                  onRetryPlayback={() => {
                    if (activeTrack)
                      void selectTrack(activeTrack, true, playbackClock.getTime(), false);
                  }}
                  lyricsOpen={lyricsOpen}
                  onToggleLyrics={() => setLyricsOpen((open) => !open)}
                  activeTrack={activeTrack}
                  activeTags={activeTags}
                  isPlaying={isPlaying}
                  isLoading={isLoadingTrack}
                  hasWaveform={hasWaveform}
                  shouldAnimateWaveform={shouldAnimateWaveform}
                  reduceMotion={reduceMotion}
                  isFavorite={activeTrack ? favoriteTrackSet.has(activeTrack.id) : false}
                  playbackClock={playbackClock}
                  duration={duration}
                  waveformRef={setWaveformElement}
                  onTogglePlayback={togglePlayback}
                  onPreviousTrack={() => playAdjacentTrack(-1)}
                  onNextTrack={() => playAdjacentTrack(1)}
                  shuffleEnabled={shuffleEnabled}
                  repeatMode={repeatMode}
                  volume={volume}
                  onToggleShuffle={() => {
                    const nextShuffleEnabled = !shuffleEnabled;
                    const nextQueue = nextShuffleEnabled
                      ? {
                          ...library.settings.session.queue,
                          shuffledItems: smartShuffleQueue(
                            library.settings.session.queue.items,
                            library.settings.session.queue.activeItemId,
                            allPlayableTracksById,
                          ),
                        }
                      : library.settings.session.queue;
                    setShuffleEnabled(nextShuffleEnabled);
                    persistSessionSettings({
                      ...library.settings.session,
                      shuffleEnabled: nextShuffleEnabled,
                      repeatMode,
                      queue: nextQueue,
                    });
                  }}
                  onCycleRepeat={() => {
                    const nextRepeatMode =
                      repeatMode === "off" ? "all" : repeatMode === "all" ? "one" : "off";
                    setRepeatMode(nextRepeatMode);
                    persistSessionSettings({
                      ...library.settings.session,
                      shuffleEnabled,
                      repeatMode: nextRepeatMode,
                    });
                  }}
                  onToggleFavorite={() => {
                    if (activeTrack) {
                      void toggleFavoriteTrack(activeTrack.id);
                    }
                  }}
                  onTrackInfoContextMenu={setPlayerTrackMenuPoint}
                  onRevealPlayingTrack={revealPlayingTrack}
                  maxVolume={maxVolume}
                  volumeBoostEnabled={volumeBoostEnabled}
                  limiterActive={limiterActive}
                  equalizer={equalizer}
                  levelsOpen={levelMeters.open}
                  onToggleLevels={toggleLevelMeters}
                  levels={
                    <LevelsPanel
                      open={levelMeters.open}
                      isPlaying={isPlaying}
                      reduceMotion={reduceMotion}
                      readLevels={readLevels}
                      onMeteringChange={setMeteringEnabled}
                    />
                  }
                  onEqualizerPreview={previewEqualizer}
                  onEqualizerChange={changeEqualizer}
                  onVolumeChange={setPlayerVolume}
                  onVolumeBoostChange={(enabled) =>
                    void updatePlaybackSettings({
                      ...library.settings.playback,
                      volumeBoostEnabled: enabled,
                    })
                  }
                />

                {activeTrack && (
                  <TrackRowMenu
                    track={activeTrack}
                    selectedTracks={[activeTrack]}
                    playlists={library.playlists}
                    tags={library.tags || []}
                    selectedPlaylist={activeTrackSelectedPlaylist}
                    selectedTag={activeTrackSelectedTag}
                    menuIcon={HiddenTrackMenuIcon}
                    open={Boolean(playerTrackMenuPoint)}
                    showTrigger={false}
                    anchorPoint={playerTrackMenuPoint}
                    onOpenChange={(open, point) => {
                      setPlayerTrackMenuPoint(open ? point : null);
                    }}
                    onAddToPlaylist={(track, playlist) => addTrackToPlaylist(track.id, playlist)}
                    onAddTracksToPlaylist={(tracksToAdd, playlist) =>
                      addTracksToPlaylist(
                        tracksToAdd.map((track) => track.id),
                        playlist,
                      )
                    }
                    onCreatePlaylist={(tracksToAdd) => {
                      setTracksPendingPlaylistCreation(tracksToAdd);
                      setIsCreatePlaylistOpen(true);
                    }}
                    onAddTracksToTag={(tracksToAdd, tag) =>
                      addTracksToTag(
                        tracksToAdd.map((track) => track.id),
                        tag,
                      )
                    }
                    onCreateTag={(tracksToAdd) => {
                      setTracksPendingTagCreation(tracksToAdd);
                      setIsCreateTagOpen(true);
                    }}
                    onRemoveFromPlaylist={requestRemoveTracksFromSelectedPlaylist}
                    onRemoveFromTag={removeTracksFromSelectedTag}
                    onShowInFolder={(track) => window.playhead.showItemInFolder(track.path)}
                    onShowMetadata={(track) => setMetadataDialog({ track })}
                    onViewArtist={
                      library.settings.library.mode === "library" ? viewTrackArtist : undefined
                    }
                    onViewAlbum={
                      library.settings.library.mode === "library" ? viewTrackAlbum : undefined
                    }
                    fileActionsEnabled={!isSoundCloudTrack(activeTrack)}
                  />
                )}

                {lyricsOpen ? (
                  <LyricsPanel
                    key={activeTrack?.id || "empty"}
                    track={activeTrack}
                    clock={playbackClock}
                    reduceMotion={reduceMotion}
                    onSeek={seekToLyric}
                    onClose={closeLyrics}
                  />
                ) : selectedSource?.type === "library-artists" ? (
                  <LibraryBrowser
                    emptyLabel="No artists to show."
                    artists={libraryArtists}
                    selectedItemIds={selectedLibraryBrowserItemIds}
                    scrollKey={selectedSourceScrollKey}
                    initialScrollTop={
                      sourceScrollPositionsRef.current[selectedSourceScrollKey] || 0
                    }
                    playlists={library.playlists}
                    onSelectArtist={(artist, event) =>
                      selectLibraryBrowserItem(
                        artist.id,
                        libraryArtists.map((item) => item.id),
                        event,
                      )
                    }
                    onActivateArtist={(artist) =>
                      selectLibrarySource({ type: "library-artist", id: artist.id })
                    }
                    onAddTrackIdsToPlaylist={addTracksToPlaylist}
                    onScrollPositionChange={(scrollTop) => {
                      sourceScrollPositionsRef.current[selectedSourceScrollKey] = scrollTop;
                    }}
                  />
                ) : selectedSource?.type === "library-albums" ? (
                  <LibraryBrowser
                    emptyLabel="No albums to show."
                    albums={libraryAlbums}
                    selectedItemIds={selectedLibraryBrowserItemIds}
                    scrollKey={selectedSourceScrollKey}
                    initialScrollTop={
                      sourceScrollPositionsRef.current[selectedSourceScrollKey] || 0
                    }
                    playlists={library.playlists}
                    onSelectAlbum={(album, event) =>
                      selectLibraryBrowserItem(
                        album.id,
                        libraryAlbums.map((item) => item.id),
                        event,
                      )
                    }
                    onActivateAlbum={(album) =>
                      selectLibrarySource({ type: "library-album", id: album.id })
                    }
                    onAddTrackIdsToPlaylist={addTracksToPlaylist}
                    onScrollPositionChange={(scrollTop) => {
                      sourceScrollPositionsRef.current[selectedSourceScrollKey] = scrollTop;
                    }}
                  />
                ) : (
                  <>
                    {(selectedLibraryArtist || selectedLibraryAlbum) && (
                      <LibraryDetailHeader
                        artist={selectedLibraryArtist}
                        album={selectedLibraryAlbum}
                        onBack={backFromLibraryDetail}
                      />
                    )}
                    <TrackList
                      tracks={tracks}
                      settings={trackListSettings}
                      onSettingsChange={(trackList) =>
                        persistSessionSettings({
                          ...libraryRef.current.settings.session,
                          trackList,
                        })
                      }
                      activeTrackId={activeTrackId}
                      isPlaying={isPlaying}
                      selectedTrackIds={selectedTrackIds}
                      scrollKey={selectedSourceScrollKey}
                      initialScrollTop={
                        sourceScrollPositionsRef.current[selectedSourceScrollKey] || 0
                      }
                      scrollToTrackId={scrollToTrackId}
                      scrollToTrackAlign={trackScrollRequest?.align}
                      focusScrolledTrack={trackScrollRequest?.focus}
                      selectedPlaylist={selectedPlaylist}
                      selectedTag={selectedTag}
                      canReorderTracks={
                        selectedSource?.type !== "library-tracks" &&
                        selectedSource?.type !== "tag" &&
                        (selectedSource?.type !== "soundcloud" ||
                          Boolean(selectedSoundCloudPlaylistId))
                      }
                      canRemoveFromPlaylist={Boolean(selectedSoundCloudPlaylistId)}
                      isLoading={
                        selectedSource?.type === "soundcloud" &&
                        soundcloudLoadingCollectionId === selectedSource.id
                      }
                      playlists={library.playlists}
                      tags={library.tags || []}
                      favoriteTrackIds={favoriteTrackIds}
                      onSelectTrack={selectTrackInList}
                      onPlayTrack={(track) => selectTrack(track, true, undefined, true, "source")}
                      onAddToPlaylist={(track, playlist) => addTrackToPlaylist(track.id, playlist)}
                      onAddTracksToPlaylist={(tracks, playlist) =>
                        addTracksToPlaylist(
                          tracks.map((track) => track.id),
                          playlist,
                        )
                      }
                      onCreatePlaylist={(tracks) => {
                        setTracksPendingPlaylistCreation(tracks);
                        setIsCreatePlaylistOpen(true);
                      }}
                      onAddTracksToTag={(tracks, tag) =>
                        addTracksToTag(
                          tracks.map((track) => track.id),
                          tag,
                        )
                      }
                      onCreateTag={(tracks) => {
                        setTracksPendingTagCreation(tracks);
                        setIsCreateTagOpen(true);
                      }}
                      onToggleFavorite={(track) => toggleFavoriteTrack(track.id)}
                      onRemoveFromPlaylist={requestRemoveTracksFromListedPlaylist}
                      onCreateSoundCloudPlaylist={
                        soundcloudState.connected
                          ? (tracksToAdd) =>
                              setSoundCloudPlaylistDialog({ mode: "create", tracks: tracksToAdd })
                          : undefined
                      }
                      onRemoveFromTag={removeTracksFromSelectedTag}
                      onShowInFolder={(track) => window.playhead.showItemInFolder(track.path)}
                      onShowMetadata={(track) => setMetadataDialog({ track })}
                      onViewArtist={
                        library.settings.library.mode === "library" ? viewTrackArtist : undefined
                      }
                      onViewAlbum={
                        library.settings.library.mode === "library" ? viewTrackAlbum : undefined
                      }
                      onReorderTrack={(trackIds, targetTrackId, edge) =>
                        selectedSoundCloudPlaylistId
                          ? reorderSoundCloudPlaylist(
                              selectedSoundCloudPlaylistId,
                              trackIds,
                              targetTrackId,
                              edge,
                            )
                          : reorderTrack(trackIds, targetTrackId, edge)
                      }
                      onScrollPositionChange={(scrollTop) => {
                        sourceScrollPositionsRef.current[selectedSourceScrollKey] = scrollTop;
                      }}
                      onScrolledToTrack={() => setScrollToTrackId(null)}
                    />
                  </>
                )}
              </>
            )}
          </main>
        </section>
        <AnimatePresence>
          {metadataDialog && (
            <MetadataDialog
              key="metadata"
              track={metadataDialog.track}
              onSave={saveTrackMetadata}
              onClose={() => setMetadataDialog(null)}
            />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {isSearchOpen && (
            <TrackSearchDialog
              key="search"
              tracks={allTracks}
              folders={library.folders}
              artists={libraryArtists}
              albums={libraryAlbums}
              playlists={library.playlists}
              tags={library.tags || []}
              libraryMode={library.settings.library.mode}
              scope={searchScope}
              soundcloudSearchEnabled={
                soundcloudState.connected && library.settings.soundcloud.enabled
              }
              onSelectTrack={playSearchResult}
              onSelectArtist={(artist) => {
                setIsSearchOpen(false);
                selectLibrarySource({ type: "library-artist", id: artist.id });
              }}
              onSelectAlbum={(album) => {
                setIsSearchOpen(false);
                selectLibrarySource({ type: "library-album", id: album.id });
              }}
              onAddToPlaylist={(track, playlist) => addTrackToPlaylist(track.id, playlist)}
              onAddTracksToPlaylist={addTracksToPlaylist}
              onCreatePlaylist={(tracks) => {
                setTracksPendingPlaylistCreation(tracks);
                setIsCreatePlaylistOpen(true);
              }}
              onAddTracksToTag={(tracks, tag) =>
                addTracksToTag(
                  tracks.map((track) => track.id),
                  tag,
                )
              }
              onCreateTag={(tracks) => {
                setTracksPendingTagCreation(tracks);
                setIsCreateTagOpen(true);
              }}
              onShowInFolder={(track) => window.playhead.showItemInFolder(track.path)}
              onShowMetadata={(track) => {
                setIsSearchOpen(false);
                setMetadataDialog({ track });
              }}
              onClose={() => setIsSearchOpen(false)}
            />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {isSettingsOpen && (
            <SettingsDialog
              key="settings"
              librarySettings={library.settings.library}
              libraryFolders={library.folders}
              isScanning={isScanning}
              onAddLibraryFolder={() => void addFolder()}
              onDropLibraryFolderPaths={(folderPaths) => void addFolderPaths(folderPaths)}
              onLibrarySettingsChange={(settings) => void updateLibrarySettings(settings)}
              onRemoveLibraryFolder={setFolderPendingRemoval}
              playbackSettings={library.settings.playback}
              onPlaybackSettingsChange={(settings) => void updatePlaybackSettings(settings)}
              appearanceSettings={library.settings.appearance}
              onAppearanceSettingsChange={(settings) => void updateAppearanceSettings(settings)}
              onAppearancePreviewChange={setPreviewAppTransparency}
              telemetrySettings={library.settings.telemetry}
              onTelemetrySettingsChange={(settings) => void updateTelemetrySettings(settings)}
              lastfmState={lastfmState}
              lastfmSettings={library.settings.lastfm}
              lastfmActionPending={lastfmActionPending}
              soundcloudState={soundcloudState}
              soundcloudSettings={library.settings.soundcloud}
              soundcloudActionPending={soundcloudActionPending}
              onLastfmSettingsChange={(settings) => void updateLastfmSettings(settings)}
              onStartLastfmAuth={startLastfmAuth}
              onCompleteLastfmAuth={completeLastfmAuth}
              onCancelLastfmAuth={disconnectLastfm}
              onDisconnectLastfm={disconnectLastfm}
              onFlushLastfmQueue={flushLastfmQueue}
              onSoundCloudSettingsChange={(settings) => void updateSoundCloudSettings(settings)}
              onStartSoundCloudAuth={startSoundCloudAuth}
              onCompleteSoundCloudAuth={completeSoundCloudAuth}
              onCancelSoundCloudAuth={cancelSoundCloudAuth}
              onDisconnectSoundCloud={disconnectSoundCloud}
              onAdvancedAction={runAdvancedSettingsAction}
              batchAnalysis={batchAnalysis}
              onAnalyzeMissingAudioData={analyzeMissingAudioData}
              onClose={() => setIsSettingsOpen(false)}
            />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {updateMessage && (
            <UpdateMessageDialog
              key="update-message"
              message={updateMessage.message}
              onClose={() => {
                dismissUpdateMessage(updateMessage.version);
                setUpdateMessage(null);
              }}
            />
          )}
          {folderPendingRemoval && (
            <RemoveFolderDialog
              key={`remove-folder-${folderPendingRemoval.id}`}
              folder={folderPendingRemoval}
              onConfirm={() => {
                const folderId = folderPendingRemoval.id;
                setFolderPendingRemoval(null);
                void removeFolderFromPlayhead(folderId);
              }}
              onClose={() => setFolderPendingRemoval(null)}
            />
          )}
          {soundcloudPlaylistPendingDeletion && (
            <DeletePlaylistDialog
              key={`delete-soundcloud-playlist-${soundcloudPlaylistPendingDeletion.id}`}
              name={soundcloudPlaylistPendingDeletion.title}
              description="This permanently deletes the playlist from your SoundCloud account. It can't be undone."
              onConfirm={() => {
                const collection = soundcloudPlaylistPendingDeletion;
                setSoundCloudPlaylistPendingDeletion(null);
                void deleteSoundCloudPlaylist(collection);
              }}
              onClose={() => setSoundCloudPlaylistPendingDeletion(null)}
            />
          )}
          {soundcloudPlaylistDialog && (
            <CreatePlaylistDialog
              key="soundcloud-playlist"
              title={
                soundcloudPlaylistDialog.mode === "create"
                  ? "New SoundCloud Playlist"
                  : "Rename SoundCloud Playlist"
              }
              description={
                soundcloudPlaylistDialog.mode === "rename"
                  ? "The new name is saved to SoundCloud."
                  : soundcloudPlaylistDialog.tracks.length > 0
                    ? `Creates a private playlist on SoundCloud with ${soundcloudPlaylistDialog.tracks.length} ${soundcloudPlaylistDialog.tracks.length === 1 ? "track" : "tracks"}.`
                    : "Creates a private playlist on SoundCloud."
              }
              initialName={
                soundcloudPlaylistDialog.mode === "rename"
                  ? soundcloudPlaylistDialog.collection.title
                  : ""
              }
              submitLabel={soundcloudPlaylistDialog.mode === "create" ? "Create" : "Rename"}
              onCreate={(name) => {
                const dialog = soundcloudPlaylistDialog;
                setSoundCloudPlaylistDialog(null);
                if (dialog.mode === "create") void createSoundCloudPlaylist(name, dialog.tracks);
                else void renameSoundCloudPlaylist(dialog.collection, name);
              }}
              onClose={() => setSoundCloudPlaylistDialog(null)}
            />
          )}
          {playlistPendingDeletion && (
            <DeletePlaylistDialog
              key={`delete-playlist-${playlistPendingDeletion.id}`}
              name={playlistPendingDeletion.name}
              onConfirm={() => {
                const playlistId = playlistPendingDeletion.id;
                setPlaylistPendingDeletion(null);
                void deletePlaylist(playlistId);
              }}
              onClose={() => setPlaylistPendingDeletion(null)}
            />
          )}
          {tagPendingDeletion && (
            <DeleteTagDialog
              key={`delete-tag-${tagPendingDeletion.id}`}
              tag={tagPendingDeletion}
              onConfirm={() => {
                const tagId = tagPendingDeletion.id;
                setTagPendingDeletion(null);
                void deleteTag(tagId);
              }}
              onClose={() => setTagPendingDeletion(null)}
            />
          )}
          {playlistTrackIdsPendingRemoval.length > 1 &&
            (selectedPlaylist || selectedSoundCloudPlaylistId) && (
              <RemoveTracksFromPlaylistDialog
                key="remove-tracks-from-playlist"
                trackCount={playlistTrackIdsPendingRemoval.length}
                playlistName={
                  selectedSoundCloudPlaylistId
                    ? soundCloudCollectionTitle(selectedSoundCloudPlaylistId)
                    : selectedPlaylist?.name || "playlist"
                }
                onConfirm={() => {
                  const trackIds = playlistTrackIdsPendingRemoval;
                  setPlaylistTrackIdsPendingRemoval([]);
                  if (selectedSoundCloudPlaylistId)
                    void removeTracksFromSoundCloudPlaylist(selectedSoundCloudPlaylistId, trackIds);
                  else void removeTracksFromSelectedPlaylist(trackIds);
                }}
                onClose={() => setPlaylistTrackIdsPendingRemoval([])}
              />
            )}
          {isCreatePlaylistOpen && (
            <CreatePlaylistDialog
              key="create-playlist"
              description={
                tracksPendingPlaylistCreation.length === 1
                  ? `Name the playlist. ${tracksPendingPlaylistCreation[0].title} will be added to it.`
                  : tracksPendingPlaylistCreation.length > 1
                    ? `Name the playlist. ${tracksPendingPlaylistCreation.length} tracks will be added to it.`
                    : undefined
              }
              onCreate={(name) => void createNewPlaylist(name, tracksPendingPlaylistCreation)}
              onClose={() => {
                setIsCreatePlaylistOpen(false);
                setTracksPendingPlaylistCreation([]);
              }}
            />
          )}
          {isCreateTagOpen && (
            <CreatePlaylistDialog
              key="create-tag"
              title="Create Tag"
              description={
                tracksPendingTagCreation.length === 1
                  ? `Name the tag. ${tracksPendingTagCreation[0].title} will be added to it.`
                  : tracksPendingTagCreation.length > 1
                    ? `Name the tag. ${tracksPendingTagCreation.length} tracks will be added to it.`
                    : "Name the tag before adding it to Playhead."
              }
              submitLabel="Create"
              onCreate={(name) => void createNewTag(name, tracksPendingTagCreation)}
              onClose={() => {
                setIsCreateTagOpen(false);
                setTracksPendingTagCreation([]);
              }}
            />
          )}
          {renamingPlaylistId && (
            <CreatePlaylistDialog
              key={`rename-playlist-${renamingPlaylistId}`}
              title="Rename Playlist"
              description="Update the playlist name."
              initialName={
                library.playlists.find((playlist) => playlist.id === renamingPlaylistId)?.name || ""
              }
              submitLabel="Rename"
              onCreate={(name) => void renamePlaylist(renamingPlaylistId, name)}
              onClose={() => setRenamingPlaylistId(null)}
            />
          )}
          {renamingTagId && (
            <CreatePlaylistDialog
              key={`rename-tag-${renamingTagId}`}
              title="Rename Tag"
              description="Update the tag name."
              initialName={(library.tags || []).find((tag) => tag.id === renamingTagId)?.name || ""}
              submitLabel="Rename"
              onCreate={(name) => void renameTag(renamingTagId, name)}
              onClose={() => setRenamingTagId(null)}
            />
          )}
        </AnimatePresence>
      </main>
    </MotionConfig>
  );
}
