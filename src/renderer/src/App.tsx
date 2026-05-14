import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, MotionConfig } from "framer-motion";
import WaveSurfer from "wavesurfer.js";
import {
  type AppearanceSettings,
  type AppUpdateState,
  type EditableTrackMetadata,
  type LastfmSettings,
  type LastfmState,
  type LastfmTrackPayload,
  type LibraryFolder,
  type LibrarySettings,
  type LibraryMode,
  type LibraryPlaylist,
  type LibraryState,
  type LibraryTag,
  type LibraryTrack,
  type PlaybackSettings,
  type TelemetrySettings,
  defaultSessionSettings,
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
import type { RepeatMode } from "@/features/player/types";
import { TrackSearchDialog } from "@/features/search/TrackSearchDialog";
import { SettingsDialog, type AdvancedSettingsAction } from "@/features/settings/SettingsDialog";
import { DeletePlaylistDialog } from "@/features/sidebar/DeletePlaylistDialog";
import { DeleteTagDialog } from "@/features/sidebar/DeleteTagDialog";
import { RemoveFolderDialog } from "@/features/sidebar/RemoveFolderDialog";
import { Sidebar } from "@/features/sidebar/Sidebar";
import { TrackList } from "@/features/tracks/TrackList";
import { RemoveTracksFromPlaylistDialog } from "@/features/tracks/RemoveTracksFromPlaylistDialog";
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
  decodeAudioTrack,
  shouldAnalyzeTrackBpm,
  waveformAnalysisMaxPeaks,
  waveformAnalysisPeakRate,
} from "@/features/audio/audio-analysis";
import {
  emptyLibraryState,
  getLibraryAlbums,
  getLibraryArtists,
  getAllLibraryTracks,
  getSourceTracks,
  getTrackAlbumId,
  getTrackArtistId,
  mergeScannedFolder,
} from "@/features/library/library-model";
import { useLibraryActions } from "@/features/library/use-library-actions";
import { EmptyLibraryState } from "@/features/library/EmptyLibraryState";
import { LibraryDetailHeader } from "@/features/library/LibraryDetailHeader";
import { LibraryBrowser } from "@/features/library/LibraryBrowser";
import { normalizeSourceForMode } from "@/features/library/source";
import { usePlayerKeyboardShortcuts } from "@/hooks/use-player-keyboard-shortcuts";
import { useWindowDrag } from "@/hooks/use-window-drag";

const waveformCachePeakRate = waveformAnalysisPeakRate;
const waveformCacheMaxPeaks = waveformAnalysisMaxPeaks;
const sidebarWidth = 260;

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

function getQueueSourceTitle(library: LibraryState): string {
  const source = library.selectedSource;
  if (!source) return "Queue";
  if (source.type === "library-tracks") return "Tracks";
  if (source.type === "library-artists") return "Artists";
  if (source.type === "library-albums") return "Albums";
  if (source.type === "folder") {
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

function getErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error) || !error.message) return fallback;

  return error.message.replace(/^Error invoking remote method '[^']+': Error: /, "");
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
  const didLoadLibraryRef = useRef(false);
  const didRestoreSessionRef = useRef(false);
  const lastPositionSaveRef = useRef(0);
  const selectionAnchorTrackIdRef = useRef<string | null>(null);
  const libraryBrowserSelectionAnchorIdRef = useRef<string | null>(null);
  const trackLoadRequestIdRef = useRef(0);
  const trackLoadQueueRef = useRef(Promise.resolve());
  const bpmAnalysisQueueRef = useRef(Promise.resolve());
  const bpmAnalysisTrackIdsRef = useRef(new Set<string>());
  const loadedTrackIdRef = useRef<string | null>(null);
  const lastLibraryBackGestureAtRef = useRef(0);
  const lastfmPlaybackSessionRef = useRef<LastfmPlaybackSession | null>(null);
  const lastfmNowPlayingTrackIdRef = useRef<string | null>(null);
  const libraryRef = useRef<LibraryState>(emptyLibraryState());

  const [library, setLibrary] = useState<LibraryState>(emptyLibraryState);
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([]);
  const [hasWaveform, setHasWaveform] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [waveformElement, setWaveformElement] = useState<HTMLDivElement | null>(null);
  const [isWaveformEngineReady, setIsWaveformEngineReady] = useState(false);
  const [shouldAnimateWaveform, setShouldAnimateWaveform] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isLoadingTrack, setIsLoadingTrack] = useState(false);
  const [, setError] = useState("");
  const [metadataDialog, setMetadataDialog] = useState<MetadataDialogState>(null);
  const [shuffleEnabled, setShuffleEnabled] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("off");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
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
  const [tagPendingDeletion, setTagPendingDeletion] = useState<LibraryTag | null>(null);
  const [playlistTrackIdsPendingRemoval, setPlaylistTrackIdsPendingRemoval] = useState<string[]>(
    [],
  );
  const [selectedLibraryBrowserItemIds, setSelectedLibraryBrowserItemIds] = useState<string[]>([]);
  const [renamingPlaylistId, setRenamingPlaylistId] = useState<string | null>(null);
  const [renamingTagId, setRenamingTagId] = useState<string | null>(null);
  const [scrollToTrackId, setScrollToTrackId] = useState<string | null>(null);
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
  const [batchAnalysis, setBatchAnalysis] = useState<BatchAnalysisState>(emptyBatchAnalysisState);

  const tracks = useMemo(() => getSourceTracks(library), [library]);
  const allTracks = useMemo(() => Object.values(library.tracks), [library.tracks]);
  const libraryArtists = useMemo(() => getLibraryArtists(library), [library]);
  const libraryAlbums = useMemo(() => getLibraryAlbums(library), [library]);
  const libraryTrackCount = useMemo(() => getAllLibraryTracks(library).length, [library]);
  const activeTrack = activeTrackId ? library.tracks[activeTrackId] : null;
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
      return library.folders.find((folder) => folder.id === source.id)?.name || "Folder";
    }
    if (source.type === "loved") return "Loved";
    if (source.type === "tag") {
      return (library.tags || []).find((tag) => tag.id === source.id)?.name || "Tag";
    }
    return library.playlists.find((playlist) => playlist.id === source.id)?.name || "Playlist";
  }, [library, libraryAlbums, libraryArtists]);
  const appTransparency =
    (previewAppTransparency ?? library.settings.appearance.appTransparency) / 100;
  const reduceMotion = library.settings.appearance.reduceMotion;

  const persistLibrary = useCallback(async (nextState: LibraryState) => {
    libraryRef.current = nextState;
    setLibrary(nextState);
    await window.playhead.saveLibraryState(nextState);
    await window.playhead.watchLibraryFolders(
      nextState.settings.library.watchFolders ? nextState.folders : [],
      nextState.settings.library.enabledAudioExtensions,
    );
  }, []);

  const persistSessionSettings = useCallback(
    (nextSession: LibraryState["settings"]["session"]) => {
      void window.playhead.saveLibraryState({
        ...library,
        settings: { ...library.settings, session: nextSession },
      });
      setLibrary((current) => ({
        ...current,
        settings: { ...current.settings, session: nextSession },
      }));
    },
    [library],
  );

  const saveAnalyzedBpm = useCallback((trackId: string, bpm: number) => {
    const current = libraryRef.current;
    const track = current.tracks[trackId];
    if (!track) return;

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
    setLibrary(nextState);
    void window.playhead.saveLibraryState(nextState);
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

  const getBatchAnalysisCandidates = useCallback(
    async (tracksToCheck: LibraryTrack[]) => {
      const candidates: LibraryTrack[] = [];

      for (const track of tracksToCheck) {
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
    [saveAnalyzedBpm],
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

  const selectTrack = useCallback(
    async (
      track: LibraryTrack,
      autoplay = true,
      startTime = 0,
      allowSkipUnavailable = true,
      queueMode: "preserve" | "source" = "preserve",
      activeQueueItemId?: string,
    ) => {
      const wavesurfer = wavesurferRef.current;
      if (!wavesurfer) return;
      const requestId = trackLoadRequestIdRef.current + 1;
      trackLoadRequestIdRef.current = requestId;
      loadedTrackIdRef.current = null;
      lastfmPlaybackSessionRef.current = null;
      lastfmNowPlayingTrackIdRef.current = null;

      wavesurfer.pause();
      setIsLoadingTrack(true);
      setShouldAnimateWaveform(false);
      setError("");
      setActiveTrackId(track.id);
      setCurrentTime(0);
      setDuration(track.duration || 0);
      setIsPlaying(false);
      const nextQueue =
        queueMode === "source"
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
                library.tracks,
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
      });

      try {
        const audioUrl = await window.playhead.getAudioFileUrl(track.path);
        if (requestId !== trackLoadRequestIdRef.current) return;
        const waveformCacheRequest = {
          trackId: track.id,
          path: track.path,
          duration: track.duration,
        };
        const cachedWaveform = await window.playhead.getWaveformCache(waveformCacheRequest);
        if (requestId !== trackLoadRequestIdRef.current) return;
        setShouldAnimateWaveform(!cachedWaveform);
        if (!cachedWaveform) setHasWaveform(false);

        await (trackLoadQueueRef.current = trackLoadQueueRef.current
          .catch(() => undefined)
          .then(async () => {
            if (requestId !== trackLoadRequestIdRef.current) return;
            await wavesurfer.load(
              audioUrl,
              cachedWaveform?.peaks,
              cachedWaveform?.duration || track.duration || undefined,
            );
          }));
        if (requestId !== trackLoadRequestIdRef.current) return;

        loadedTrackIdRef.current = track.id;
        lastfmPlaybackSessionRef.current = null;
        lastfmNowPlayingTrackIdRef.current = null;
        setHasWaveform(true);
        setDuration(wavesurfer.getDuration() || track.duration || 0);
        if (!cachedWaveform) {
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
        void analyzeTrackBpm(track);
        if (startTime > 0) {
          wavesurfer.setTime(clamp(startTime, 0, wavesurfer.getDuration() || startTime));
          setCurrentTime(wavesurfer.getCurrentTime());
        }

        if (autoplay) {
          try {
            await wavesurfer.play();
          } catch {
            setIsPlaying(false);
            setError("Playback could not start.");
          }
        }
      } catch (loadError) {
        if (requestId !== trackLoadRequestIdRef.current) return;
        console.error("Failed to load track", { path: track.path, error: loadError });
        loadedTrackIdRef.current = null;
        setError("This track could not be loaded.");
        setHasWaveform(false);
        setShouldAnimateWaveform(false);
        if (autoplay && allowSkipUnavailable && library.settings.playback.skipUnavailableTracks) {
          showTrackActionToast({ action: "Skipped unavailable track", track });
          playAdjacentTrackRef.current();
        }
      } finally {
        if (requestId === trackLoadRequestIdRef.current) setIsLoadingTrack(false);
      }
    },
    [library, analyzeTrackBpm, persistSessionSettings, shuffleEnabled, tracks],
  );

  const playSearchResult = useCallback(
    async (track: LibraryTrack) => {
      setSelectedTrackIds([track.id]);
      setScrollToTrackId(track.id);
      setIsSearchOpen(false);
      await persistLibrary({
        ...library,
        selectedSource:
          library.settings.library.mode === "library"
            ? { type: "library-tracks" }
            : { type: "folder", id: track.folderId },
      });
      await selectTrack(track, true);
    },
    [library, persistLibrary, selectTrack],
  );

  const addFolder = useCallback(async () => {
    setIsScanning(true);
    setError("");

    try {
      const scannedFolders = await window.playhead.selectMusicFolder(
        library.settings.library.enabledAudioExtensions,
      );
      if (scannedFolders.length === 0) return;
      let nextState = library;
      let lastScannedFolderId: string | null = null;

      for (const scanned of scannedFolders) {
        nextState = mergeScannedFolder(nextState, scanned);
        lastScannedFolderId = scanned.folder.id;
        window.playhead.trackEvent("folder_added", {
          source: "picker",
          track_count: scanned.tracks.length,
        });
        showFolderActionToast({ folder: scanned.folder, trackCount: scanned.tracks.length });
      }

      nextState = {
        ...nextState,
        selectedSource:
          library.settings.library.mode === "library"
            ? { type: "library-tracks" as const }
            : lastScannedFolderId
              ? { type: "folder" as const, id: lastScannedFolderId }
              : nextState.selectedSource,
      };
      await persistLibrary(nextState);
    } catch (error) {
      const message = getErrorMessage(error, "Could not scan that folder.");
      setError(message);
      showSimpleActionToast(message, "error");
    } finally {
      setIsScanning(false);
    }
  }, [library, persistLibrary]);

  const addFolderPaths = useCallback(
    async (folderPaths: string[]) => {
      const uniqueFolderPaths = Array.from(new Set(folderPaths));
      if (uniqueFolderPaths.length === 0) return;

      setIsScanning(true);
      setError("");

      try {
        let nextState = library;
        let lastScannedFolderId: string | null = null;

        for (const folderPath of uniqueFolderPaths) {
          const scanned = await window.playhead.scanFolderPath(
            folderPath,
            library.settings.library.enabledAudioExtensions,
          );
          nextState = mergeScannedFolder(nextState, scanned);
          lastScannedFolderId = scanned.folder.id;
          window.playhead.trackEvent("folder_added", {
            source: "drop",
            track_count: scanned.tracks.length,
          });
          showFolderActionToast({ folder: scanned.folder, trackCount: scanned.tracks.length });
        }

        await persistLibrary({
          ...nextState,
          selectedSource:
            library.settings.library.mode === "library"
              ? { type: "library-tracks" as const }
              : lastScannedFolderId
                ? { type: "folder" as const, id: lastScannedFolderId }
                : nextState.selectedSource,
        });
      } catch (error) {
        const message = getErrorMessage(error, "Drop folders that contain audio files.");
        setError(message);
        showSimpleActionToast(message, "error");
      } finally {
        setIsScanning(false);
      }
    },
    [library, persistLibrary],
  );

  const rescanLibrary = useCallback(
    async (state: LibraryState) => {
      if (state.folders.length === 0) {
        await persistLibrary(state);
        return;
      }

      setIsScanning(true);
      setError("");

      try {
        let nextState = state;
        for (const folder of state.folders) {
          const scanned = await window.playhead.scanFolder(
            folder,
            state.settings.library.enabledAudioExtensions,
          );
          nextState = mergeScannedFolder(nextState, scanned);
        }
        if (activeTrackId && !nextState.tracks[activeTrackId]) {
          wavesurferRef.current?.stop();
          wavesurferRef.current?.empty();
          setActiveTrackId(null);
          setCurrentTime(0);
          setDuration(0);
          setIsPlaying(false);
          setHasWaveform(false);
          setShouldAnimateWaveform(false);
        }

        await persistLibrary({ ...nextState, selectedSource: state.selectedSource });
      } catch (error) {
        setError(getErrorMessage(error, "Could not rescan the library."));
      } finally {
        setIsScanning(false);
      }
    },
    [activeTrackId, persistLibrary],
  );

  const updateLibrarySettings = useCallback(
    async (settings: LibrarySettings) => {
      const nextLibrarySettings = { ...settings, watchFolders: true };
      const onlyModeChanged =
        nextLibrarySettings.mode !== library.settings.library.mode &&
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
            : library.selectedSource,
        settings: { ...library.settings, library: nextLibrarySettings },
      };
      if (onlyModeChanged) {
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

  const clearPlaybackState = useCallback(() => {
    wavesurferRef.current?.stop();
    wavesurferRef.current?.empty();
    setActiveTrackId(null);
    setSelectedTrackIds([]);
    setScrollToTrackId(null);
    setHasWaveform(false);
    setShouldAnimateWaveform(false);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setIsLoadingTrack(false);
    setError("");
  }, []);

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
        wavesurferRef.current?.stop();
        wavesurferRef.current?.empty();
        setActiveTrackId(null);
        setCurrentTime(0);
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
    [activeTrackId, library, persistLibrary],
  );

  const toggleFavoriteTrack = useCallback(
    async (trackId: string) => {
      const track = library.tracks[trackId];
      const favoriteTrackIds = new Set(library.favoriteTrackIds || []);
      const wasFavorite = favoriteTrackIds.has(trackId);
      if (wasFavorite) favoriteTrackIds.delete(trackId);
      else favoriteTrackIds.add(trackId);

      await persistLibrary({
        ...library,
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

      if (track) {
        showTrackActionToast({
          action: wasFavorite ? "Removed from Loved" : "Added to Loved",
          track,
        });
      }
    },
    [library, persistLibrary],
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
    persistLibrary,
    setIsCreatePlaylistOpen,
    setTracksPendingPlaylistCreation,
    setIsCreateTagOpen,
    setTracksPendingTagCreation,
    setPlaylistTrackIdsPendingRemoval,
    setRenamingPlaylistId,
    setRenamingTagId,
  });

  const reorderTrack = useCallback(
    async (trackIds: string[], targetTrackId: string, edge: "before" | "after" = "before") => {
      if (trackIds.includes(targetTrackId)) return;

      const source = library.selectedSource;
      if (!source) return;
      const uniqueTrackIds = trackIds.filter(
        (trackId, index) => trackIds.indexOf(trackId) === index,
      );
      if (uniqueTrackIds.length === 0) return;

      if (source.type === "folder") {
        const folder = library.folders.find((item) => item.id === source.id);
        if (!folder) return;
        const trackIdsToMove = folder.trackIds.filter((trackId) =>
          uniqueTrackIds.includes(trackId),
        );
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
      const trackIdsToMove = playlist.trackIds.filter((trackId) =>
        uniqueTrackIds.includes(trackId),
      );
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
      const selectedTrack = selectedTrackIds[0] ? library.tracks[selectedTrackIds[0]] : null;
      const nextTrack = activeTrack || selectedTrack || tracks[0];
      if (nextTrack) await selectTrack(nextTrack, true);
      return;
    }

    if (loadedTrackIdRef.current !== activeTrackId) {
      const activeTrack = library.tracks[activeTrackId];
      if (activeTrack) await selectTrack(activeTrack, true);
      return;
    }

    await wavesurfer.playPause();
  }, [activeTrack, activeTrackId, library.tracks, selectTrack, selectedTrackIds, tracks]);

  const setPlayerVolume = useCallback((nextVolume: number) => {
    const clampedVolume = clamp(nextVolume, 0, 1);
    volumeRef.current = clampedVolume;
    setVolume(clampedVolume);
    wavesurferRef.current?.setVolume(clampedVolume);
  }, []);

  const seekBy = useCallback((offset: number) => {
    const wavesurfer = wavesurferRef.current;
    if (!wavesurfer) return;

    const nextTime = clamp(
      wavesurfer.getCurrentTime() + offset,
      0,
      wavesurfer.getDuration() || Number.POSITIVE_INFINITY,
    );
    wavesurfer.setTime(nextTime);
    setCurrentTime(wavesurfer.getCurrentTime());
  }, []);

  const changeVolumeBy = useCallback(
    (offset: number) => {
      const wavesurfer = wavesurferRef.current;
      setPlayerVolume((wavesurfer?.getVolume() ?? volumeRef.current) + offset);
    },
    [setPlayerVolume],
  );

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
      setScrollToTrackId(nextTrack.id);
    },
    [activeTrackId, selectedTrackIds, tracks],
  );

  const playSelectedTrack = useCallback(() => {
    const selectedTrack = selectedTrackIds[0] ? library.tracks[selectedTrackIds[0]] : null;
    if (selectedTrack) void selectTrack(selectedTrack, true, 0, true, "source");
  }, [library.tracks, selectTrack, selectedTrackIds]);

  const selectLibrarySource = useCallback(
    (source: LibraryState["selectedSource"]) => {
      setSelectedLibraryBrowserItemIds([]);
      libraryBrowserSelectionAnchorIdRef.current = null;
      void persistLibrary({ ...library, selectedSource: source });
    },
    [library, persistLibrary],
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

      const nextPositions = { ...library.settings.session.trackPositions };
      if (time < 3) delete nextPositions[trackId];
      else nextPositions[trackId] = time;

      persistSessionSettings({
        ...library.settings.session,
        activeTrackId: trackId,
        selectedTrackIds,
        trackPositions: nextPositions,
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
        const nextTrack = nextItem ? library.tracks[nextItem.trackId] : null;
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
      library.tracks,
      persistSessionSettings,
      selectTrack,
      selectedTrackIds,
      shuffleEnabled,
      tracks,
    ],
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
      const nextTrack = nextItem ? library.tracks[nextItem.trackId] : null;
      if (!nextTrack || !nextItem) return false;

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
    if (!nextTrack) return false;

    setScrollToTrackId(nextTrack.id);
    void selectTrack(nextTrack, true);
    return true;
  }, [
    activeTrackId,
    library.settings.session,
    library.tracks,
    persistSessionSettings,
    repeatMode,
    selectTrack,
    shuffleEnabled,
    tracks,
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
      setLibrary(nextState);
      setShuffleEnabled(nextState.settings.session.shuffleEnabled);
      setRepeatMode(nextState.settings.session.repeatMode);
      void window.playhead.watchLibraryFolders(
        nextState.settings.library.watchFolders ? nextState.folders : [],
        nextState.settings.library.enabledAudioExtensions,
      );
      if (nextState !== state) void window.playhead.saveLibraryState(nextState);
      if (nextState.settings.library.rescanOnLaunch) void rescanLibrary(nextState);
    });
  }, [rescanLibrary]);

  useEffect(() => {
    if (didRestoreSessionRef.current || !isWaveformEngineReady) return;
    if (!library.settings.playback.restoreLastSession) return;

    const trackId = library.settings.session.activeTrackId;
    const track = trackId ? library.tracks[trackId] : null;
    if (!track) return;

    didRestoreSessionRef.current = true;
    setSelectedTrackIds(library.settings.session.selectedTrackIds);
    setScrollToTrackId(track.id);
    void selectTrack(track, false, library.settings.session.trackPositions[track.id] || 0);
  }, [isWaveformEngineReady, library, selectTrack]);

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
    return window.playhead.onFolderChanged((folderId) => {
      const folder = library.folders.find((item) => item.id === folderId);
      if (!folder) return;

      void window.playhead
        .scanFolder(folder, library.settings.library.enabledAudioExtensions)
        .then((scanned) => persistLibrary(mergeScannedFolder(library, scanned)))
        .catch((error) => setError(getErrorMessage(error, "Could not rescan changed folder.")));
    });
  }, [library, persistLibrary]);

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
    wavesurfer.setVolume(volumeRef.current);

    wavesurferRef.current = wavesurfer;
    setIsWaveformEngineReady(true);
    const unsubscribers = [
      wavesurfer.on("ready", (nextDuration) => {
        setDuration(nextDuration || 0);
        setCurrentTime(wavesurfer.getCurrentTime());
      }),
      wavesurfer.on("timeupdate", (time) => {
        setCurrentTime(time);
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
        setCurrentTime(time);
        const session = lastfmPlaybackSessionRef.current;
        if (session) lastfmPlaybackSessionRef.current = { ...session, lastTime: time };
      }),
      wavesurfer.on("play", () => {
        setIsPlaying(true);
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
      wavesurfer.on("pause", () => setIsPlaying(false)),
      wavesurfer.on("finish", () => {
        if (activeTrackIdRef.current) clearTrackPositionRef.current(activeTrackIdRef.current);
        lastfmPlaybackSessionRef.current = null;
        if (!playNextTrackOnEndRef.current()) setIsPlaying(false);
      }),
      wavesurfer.on("error", () => {
        setError("This track could not be loaded.");
        setHasWaveform(false);
        setShouldAnimateWaveform(false);
        setIsLoadingTrack(false);
      }),
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      wavesurfer.destroy();
      wavesurferRef.current = null;
      setIsWaveformEngineReady(false);
    };
  }, [waveformElement]);

  usePlayerKeyboardShortcuts({
    playbackSettings: library.settings.playback,
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

  useEffect(() => {
    updateMediaPosition(duration, currentTime);
  }, [currentTime, duration]);

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
      setCurrentTime(wavesurfer.getCurrentTime());
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
  }, [isPlaying, playAdjacentTrack, seekBy, togglePlayback]);

  const selectedSource = library.selectedSource;
  const selectedPlaylist =
    selectedSource?.type === "playlist"
      ? library.playlists.find((playlist) => playlist.id === selectedSource.id) || null
      : null;
  const selectedTag =
    selectedSource?.type === "tag"
      ? (library.tags || []).find((tag) => tag.id === selectedSource.id) || null
      : null;
  const playbackQueue = usePlaybackQueue({
    library,
    shuffleEnabled,
    persistSessionSettings,
    selectTrack,
    setSelectedTrackIds,
    setScrollToTrackId,
  });

  const hasLovedTracks = (library.favoriteTrackIds || []).some(
    (trackId) => library.tracks[trackId],
  );
  const isLibraryEmpty =
    library.folders.length === 0 && library.playlists.length === 0 && !hasLovedTracks;

  return (
    <MotionConfig reducedMotion={reduceMotion ? "always" : "never"}>
      <main
        className={`app-window app-drag h-dvh overflow-hidden bg-transparent text-foreground ${
          reduceMotion ? "reduce-motion" : ""
        }`}
      >
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
                tracksById={library.tracks}
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
                libraryMode={library.settings.library.mode}
                artistCount={libraryArtists.length}
                albumCount={libraryAlbums.length}
                trackCount={libraryTrackCount}
                playlists={library.playlists}
                tags={library.tags || []}
                lovedCount={hasLovedTracks ? library.favoriteTrackIds.length : 0}
                selectedSource={library.selectedSource}
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
                onCreateTag={() => setIsCreateTagOpen(true)}
                onSelectSource={selectLibrarySource}
                onDropTrackToPlaylist={(trackIds, playlist) =>
                  void addTracksToPlaylist(trackIds, playlist)
                }
                onDropTrackToTag={(trackIds, tag) => void addTracksToTag(trackIds, tag)}
                onRemoveFolder={(folder) => setFolderPendingRemoval(folder)}
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
                  activeTrack={activeTrack}
                  activeTags={
                    activeTrack
                      ? (library.tags || []).filter((tag) => tag.trackIds.includes(activeTrack.id))
                      : []
                  }
                  isPlaying={isPlaying}
                  isLoading={isLoadingTrack}
                  hasWaveform={hasWaveform}
                  shouldAnimateWaveform={shouldAnimateWaveform}
                  reduceMotion={reduceMotion}
                  isFavorite={
                    activeTrack ? (library.favoriteTrackIds || []).includes(activeTrack.id) : false
                  }
                  currentTime={currentTime}
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
                            library.tracks,
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
                    if (activeTrack) void toggleFavoriteTrack(activeTrack.id);
                  }}
                  onVolumeChange={setPlayerVolume}
                />

                {selectedSource?.type === "library-artists" ? (
                  <LibraryBrowser
                    emptyLabel="No artists to show."
                    artists={libraryArtists}
                    selectedItemIds={selectedLibraryBrowserItemIds}
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
                  />
                ) : selectedSource?.type === "library-albums" ? (
                  <LibraryBrowser
                    emptyLabel="No albums to show."
                    albums={libraryAlbums}
                    selectedItemIds={selectedLibraryBrowserItemIds}
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
                      activeTrackId={activeTrackId}
                      isPlaying={isPlaying}
                      selectedTrackIds={selectedTrackIds}
                      scrollToTrackId={scrollToTrackId}
                      selectedPlaylist={selectedPlaylist}
                      selectedTag={selectedTag}
                      canReorderTracks={
                        selectedSource?.type !== "library-tracks" && selectedSource?.type !== "tag"
                      }
                      playlists={library.playlists}
                      tags={library.tags || []}
                      favoriteTrackIds={library.favoriteTrackIds || []}
                      onSelectTrack={selectTrackInList}
                      onPlayTrack={(track) => selectTrack(track, true, 0, true, "source")}
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
                      onReorderTrack={(trackId, targetTrackId, edge) =>
                        reorderTrack(trackId, targetTrackId, edge)
                      }
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
              onLastfmSettingsChange={(settings) => void updateLastfmSettings(settings)}
              onStartLastfmAuth={startLastfmAuth}
              onCompleteLastfmAuth={completeLastfmAuth}
              onCancelLastfmAuth={disconnectLastfm}
              onDisconnectLastfm={disconnectLastfm}
              onFlushLastfmQueue={flushLastfmQueue}
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
          {playlistPendingDeletion && (
            <DeletePlaylistDialog
              key={`delete-playlist-${playlistPendingDeletion.id}`}
              playlist={playlistPendingDeletion}
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
          {playlistTrackIdsPendingRemoval.length > 1 && selectedPlaylist && (
            <RemoveTracksFromPlaylistDialog
              key="remove-tracks-from-playlist"
              trackCount={playlistTrackIdsPendingRemoval.length}
              playlistName={selectedPlaylist.name}
              onConfirm={() => {
                const trackIds = playlistTrackIdsPendingRemoval;
                setPlaylistTrackIdsPendingRemoval([]);
                void removeTracksFromSelectedPlaylist(trackIds);
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
