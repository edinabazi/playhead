import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, MotionConfig } from "framer-motion";
import { toast } from "sonner";
import WaveSurfer from "wavesurfer.js";
import {
  type EditableTrackMetadata,
  type AppearanceSettings,
  type LibraryFolder,
  type LibrarySettings,
  type LibraryMode,
  type LibraryPlaylist,
  type LibraryState,
  type LibraryTrack,
  type PlaybackSettings,
  defaultSessionSettings,
} from "../../shared/library";
import { getMediaArtworkSrc } from "@/lib/artwork";
import { isEditableTarget } from "@/lib/dom";
import { moveItem } from "@/lib/list";
import { isMacPlatform } from "@/lib/platform";
import { MetadataDialog, type MetadataDialogState } from "@/features/metadata/MetadataDialog";
import { Player } from "@/features/player/Player";
import { CreatePlaylistDialog } from "@/features/playlists/CreatePlaylistDialog";
import { setMediaActionHandler, updateMediaPosition } from "@/features/player/media-session";
import type { RepeatMode } from "@/features/player/types";
import { TrackSearchDialog } from "@/features/search/TrackSearchDialog";
import {
  SettingsDialog,
  type AdvancedSettingsAction,
} from "@/features/settings/SettingsDialog";
import { DeletePlaylistDialog } from "@/features/sidebar/DeletePlaylistDialog";
import { RemoveFolderDialog } from "@/features/sidebar/RemoveFolderDialog";
import { Sidebar } from "@/features/sidebar/Sidebar";
import { TrackList } from "@/features/tracks/TrackList";
import {
  createPlaylist,
  emptyLibraryState,
  getLibraryAlbums,
  getLibraryArtists,
  getAllLibraryTracks,
  getSourceTracks,
  mergeScannedFolder,
} from "@/features/library/library-model";
import { EmptyLibraryState } from "@/features/library/EmptyLibraryState";
import { LibraryBrowser } from "@/features/library/LibraryBrowser";

const audioMimeTypes: Record<string, string> = {
  ".aac": "audio/aac",
  ".aiff": "audio/aiff",
  ".flac": "audio/flac",
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".opus": "audio/ogg; codecs=opus",
  ".wav": "audio/wav",
};

function getAudioMimeType(path: string): string {
  const extensionStart = path.lastIndexOf(".");
  const extension = extensionStart >= 0 ? path.slice(extensionStart).toLowerCase() : "";
  return audioMimeTypes[extension] || "application/octet-stream";
}

function toArrayBuffer(value: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (value instanceof ArrayBuffer) return value;
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy.buffer;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeSourceForMode(state: LibraryState): LibraryState {
  const source = state.selectedSource;
  if (state.settings.library.mode === "library") {
    if (!source || source.type === "folder") {
      return { ...state, selectedSource: { type: "library-tracks" } };
    }
    return state;
  }

  if (
    source?.type === "library-artists" ||
    source?.type === "library-artist" ||
    source?.type === "library-albums" ||
    source?.type === "library-album" ||
    source?.type === "library-tracks"
  ) {
    return {
      ...state,
      selectedSource: state.folders[0] ? { type: "folder", id: state.folders[0].id } : null,
    };
  }

  return state;
}

function LovedTrackToast({ track }: { track: LibraryTrack }) {
  const artworkSrc = getMediaArtworkSrc(track);

  return (
    <div className="flex w-[320px] items-center gap-3 rounded-[20px] border border-white/10 bg-[rgba(10,10,10,0.96)] p-3 text-foreground shadow-2xl backdrop-blur-xl">
      <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-[14px] bg-white/10 text-[16px] font-semibold text-muted-foreground">
        {artworkSrc ? (
          <img className="size-full object-contain" src={artworkSrc} alt="" draggable={false} />
        ) : (
          <span>{track.title.slice(0, 1).toUpperCase()}</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold leading-4 text-primary">Added to Loved</p>
        <p className="mt-0.5 truncate text-[13px] font-semibold leading-4 text-foreground">
          {track.title}
        </p>
        <p className="mt-0.5 truncate text-[12px] font-medium leading-4 text-muted-foreground">
          {track.artist}
        </p>
      </div>
    </div>
  );
}

export function App() {
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const playNextTrackOnEndRef = useRef<() => boolean>(() => false);
  const playAdjacentTrackRef = useRef<() => void>(() => {});
  const activeTrackIdRef = useRef<string | null>(null);
  const rememberTrackPositionRef = useRef<(trackId: string, time: number) => void>(() => {});
  const clearTrackPositionRef = useRef<(trackId: string) => void>(() => {});
  const volumeRef = useRef(1);
  const didLoadLibraryRef = useRef(false);
  const didRestoreSessionRef = useRef(false);
  const lastPositionSaveRef = useRef(0);

  const [library, setLibrary] = useState<LibraryState>(emptyLibraryState);
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([]);
  const [hasWaveform, setHasWaveform] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [waveformElement, setWaveformElement] = useState<HTMLDivElement | null>(null);
  const [isWaveformEngineReady, setIsWaveformEngineReady] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isLoadingTrack, setIsLoadingTrack] = useState(false);
  const [error, setError] = useState("");
  const [metadataDialog, setMetadataDialog] = useState<MetadataDialogState>(null);
  const [shuffleEnabled, setShuffleEnabled] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("off");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCreatePlaylistOpen, setIsCreatePlaylistOpen] = useState(false);
  const [trackPendingPlaylistCreation, setTrackPendingPlaylistCreation] =
    useState<LibraryTrack | null>(null);
  const [folderPendingRemoval, setFolderPendingRemoval] = useState<LibraryFolder | null>(null);
  const [playlistPendingDeletion, setPlaylistPendingDeletion] =
    useState<LibraryPlaylist | null>(null);
  const [renamingPlaylistId, setRenamingPlaylistId] = useState<string | null>(null);
  const [scrollToTrackId, setScrollToTrackId] = useState<string | null>(null);
  const [previewAppTransparency, setPreviewAppTransparency] = useState<number | null>(null);

  const tracks = useMemo(() => getSourceTracks(library), [library]);
  const allTracks = useMemo(() => Object.values(library.tracks), [library.tracks]);
  const libraryArtists = useMemo(() => getLibraryArtists(library), [library]);
  const libraryAlbums = useMemo(() => getLibraryAlbums(library), [library]);
  const libraryTrackCount = useMemo(() => getAllLibraryTracks(library).length, [library]);
  const activeTrack = activeTrackId ? library.tracks[activeTrackId] : null;

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
    return library.playlists.find((playlist) => playlist.id === source.id)?.name || "Playlist";
  }, [library, libraryAlbums, libraryArtists]);
  const appTransparency =
    (previewAppTransparency ?? library.settings.appearance.appTransparency) / 100;
  const reduceMotion = library.settings.appearance.reduceMotion;

  const persistLibrary = useCallback(async (nextState: LibraryState) => {
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

  const selectTrack = useCallback(async (
    track: LibraryTrack,
    autoplay = true,
    startTime = 0,
    allowSkipUnavailable = true,
  ) => {
    const wavesurfer = wavesurferRef.current;
    if (!wavesurfer) return;

    setIsLoadingTrack(true);
    setError("");
    setActiveTrackId(track.id);
    setHasWaveform(false);
    setCurrentTime(0);
    setDuration(track.duration || 0);
    setIsPlaying(false);
    if (
      library.settings.playback.restoreLastSession ||
      library.settings.playback.rememberTrackPositions
    ) {
      persistSessionSettings({
        ...library.settings.session,
        activeTrackId: track.id,
        selectedTrackIds: [track.id],
      });
    }

    try {
      const arrayBuffer = toArrayBuffer(await window.playhead.readAudioFile(track.path));
      const blob = new Blob([arrayBuffer], { type: getAudioMimeType(track.path) });
      await wavesurfer.loadBlob(blob);
      setHasWaveform(true);
      setDuration(wavesurfer.getDuration() || track.duration || 0);
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
    } catch {
      setError("This track could not be loaded.");
      setHasWaveform(false);
      if (autoplay && allowSkipUnavailable && library.settings.playback.skipUnavailableTracks) {
        playAdjacentTrackRef.current();
      }
    } finally {
      setIsLoadingTrack(false);
    }
  }, [
    library.settings.playback.rememberTrackPositions,
    library.settings.playback.restoreLastSession,
    library.settings.playback.skipUnavailableTracks,
    library.settings.session,
    persistSessionSettings,
  ]);

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
      const scanned = await window.playhead.selectMusicFolder(
        library.settings.library.enabledAudioExtensions,
      );
      if (!scanned) return;
      const nextState = {
        ...mergeScannedFolder(library, scanned),
        selectedSource:
          library.settings.library.mode === "library"
            ? { type: "library-tracks" as const }
            : { type: "folder" as const, id: scanned.folder.id },
      };
      await persistLibrary(nextState);
    } catch {
      setError("Could not scan that folder.");
    } finally {
      setIsScanning(false);
    }
  }, [library, persistLibrary]);

  const addFolderPath = useCallback(
    async (folderPath: string) => {
      setIsScanning(true);
      setError("");

      try {
        const scanned = await window.playhead.scanFolderPath(
          folderPath,
          library.settings.library.enabledAudioExtensions,
        );
        await persistLibrary({
          ...mergeScannedFolder(library, scanned),
          selectedSource:
            library.settings.library.mode === "library"
              ? { type: "library-tracks" as const }
              : { type: "folder" as const, id: scanned.folder.id },
        });
      } catch {
        setError("Drop a folder that contains audio files.");
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
        }

        await persistLibrary({ ...nextState, selectedSource: state.selectedSource });
      } catch {
        setError("Could not rescan the library.");
      } finally {
        setIsScanning(false);
      }
    },
    [activeTrackId, persistLibrary],
  );

  const updateLibrarySettings = useCallback(
    async (settings: LibrarySettings) => {
      const onlyModeChanged =
        settings.mode !== library.settings.library.mode &&
        settings.watchFolders === library.settings.library.watchFolders &&
        settings.rescanOnLaunch === library.settings.library.rescanOnLaunch &&
        settings.enabledAudioExtensions.join("|") ===
          library.settings.library.enabledAudioExtensions.join("|");
      const nextState = {
        ...library,
        selectedSource:
          settings.mode !== library.settings.library.mode
            ? settings.mode === "library"
              ? { type: "library-tracks" as const }
              : library.folders[0]
                ? { type: "folder" as const, id: library.folders[0].id }
                : null
            : library.selectedSource,
        settings: { ...library.settings, library: settings },
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

  const clearPlaybackState = useCallback(() => {
    wavesurferRef.current?.stop();
    wavesurferRef.current?.empty();
    setActiveTrackId(null);
    setSelectedTrackIds([]);
    setScrollToTrackId(null);
    setHasWaveform(false);
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
        return "Opened Playhead's data folder.";
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

  const createNewPlaylist = useCallback(
    async (name: string, track?: LibraryTrack | null) => {
      const playlist = createPlaylist(library.playlists, name);
      await persistLibrary({
        ...library,
        playlists: [
          ...library.playlists,
          track
            ? { ...playlist, trackIds: [track.id], updatedAt: new Date().toISOString() }
            : playlist,
        ],
        selectedSource: { type: "playlist", id: playlist.id },
      });
      setIsCreatePlaylistOpen(false);
      setTrackPendingPlaylistCreation(null);
    },
    [library, persistLibrary],
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
      }

      await persistLibrary({
        ...library,
        folders: nextFolders,
        tracks: nextTracks,
        playlists: library.playlists.map((playlist) => ({
          ...playlist,
          trackIds: playlist.trackIds.filter((trackId) => !removedTrackIds.has(trackId)),
        })),
        favoriteTrackIds: (library.favoriteTrackIds || []).filter(
          (trackId) => !removedTrackIds.has(trackId),
        ),
        selectedSource,
      });
    },
    [activeTrackId, library, persistLibrary],
  );

  const renamePlaylist = useCallback(
    async (playlistId: string, name: string) => {
      const playlist = library.playlists.find((item) => item.id === playlistId);
      if (!playlist) return;

      const trimmedName = name.trim();
      if (!trimmedName || trimmedName === playlist.name) {
        setRenamingPlaylistId(null);
        return;
      }
      const now = new Date().toISOString();

      await persistLibrary({
        ...library,
        playlists: library.playlists.map((item) =>
          item.id === playlistId ? { ...item, name: trimmedName, updatedAt: now } : item,
        ),
      });
      setRenamingPlaylistId(null);
    },
    [library, persistLibrary],
  );

  const deletePlaylist = useCallback(
    async (playlistId: string) => {
      const nextPlaylists = library.playlists.filter((playlist) => playlist.id !== playlistId);

      await persistLibrary({
        ...library,
        playlists: nextPlaylists,
        selectedSource:
          library.selectedSource?.type === "playlist" && library.selectedSource.id === playlistId
            ? library.folders[0]
              ? { type: "folder", id: library.folders[0].id }
              : null
            : library.selectedSource,
      });
    },
    [library, persistLibrary],
  );

  const removeTrackFromSelectedPlaylist = useCallback(
    async (trackId: string) => {
      const source = library.selectedSource;
      if (!source || source.type !== "playlist") return;
      const now = new Date().toISOString();

      await persistLibrary({
        ...library,
        playlists: library.playlists.map((playlist) =>
          playlist.id === source.id
            ? {
                ...playlist,
                trackIds: playlist.trackIds.filter((item) => item !== trackId),
                updatedAt: now,
              }
            : playlist,
        ),
      });
    },
    [library, persistLibrary],
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

      if (track && !wasFavorite) {
        toast.custom(() => <LovedTrackToast track={track} />, {
          duration: 2600,
          unstyled: true,
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
      return updatedTrack;
    },
    [library, persistLibrary],
  );

  const addTrackToPlaylist = useCallback(
    async (trackId: string, playlist: LibraryPlaylist) => {
      if (playlist.trackIds.includes(trackId)) return;
      const now = new Date().toISOString();

      await persistLibrary({
        ...library,
        playlists: library.playlists.map((item) =>
          item.id === playlist.id
            ? { ...item, trackIds: [...item.trackIds, trackId], updatedAt: now }
            : item,
        ),
      });
    },
    [library, persistLibrary],
  );

  const reorderTrack = useCallback(
    async (trackId: string, targetTrackId: string, edge: "before" | "after" = "before") => {
      if (trackId === targetTrackId) return;

      const source = library.selectedSource;
      if (!source) return;

      if (source.type === "folder") {
        const folder = library.folders.find((item) => item.id === source.id);
        if (!folder) return;
        const fromIndex = folder.trackIds.indexOf(trackId);
        const targetIndex = folder.trackIds.indexOf(targetTrackId);
        const toIndex = edge === "after" ? targetIndex + 1 : targetIndex;
        if (fromIndex === -1 || targetIndex === -1) return;

        await persistLibrary({
          ...library,
          folders: library.folders.map((item) =>
            item.id === folder.id
              ? { ...item, trackIds: moveItem(item.trackIds, fromIndex, toIndex) }
              : item,
          ),
        });
        return;
      }

      const playlist = library.playlists.find((item) => item.id === source.id);
      if (!playlist) return;
      const fromIndex = playlist.trackIds.indexOf(trackId);
      const targetIndex = playlist.trackIds.indexOf(targetTrackId);
      const toIndex = edge === "after" ? targetIndex + 1 : targetIndex;
      if (fromIndex === -1 || targetIndex === -1) return;
      const now = new Date().toISOString();

      await persistLibrary({
        ...library,
        playlists: library.playlists.map((item) =>
          item.id === playlist.id
            ? { ...item, trackIds: moveItem(item.trackIds, fromIndex, toIndex), updatedAt: now }
            : item,
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

  const selectAdjacentTrackInList = useCallback(
    (direction: 1 | -1) => {
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
          : clamp(currentIndex + direction, 0, tracks.length - 1);
      const nextTrack = tracks[nextIndex];
      setSelectedTrackIds([nextTrack.id]);
      setScrollToTrackId(nextTrack.id);
    },
    [activeTrackId, selectedTrackIds, tracks],
  );

  const playSelectedTrack = useCallback(() => {
    const selectedTrack = selectedTrackIds[0] ? library.tracks[selectedTrackIds[0]] : null;
    if (selectedTrack) void selectTrack(selectedTrack, true);
  }, [library.tracks, selectTrack, selectedTrackIds]);

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
    [library.settings.playback.rememberTrackPositions, library.settings.session, persistSessionSettings, selectedTrackIds],
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
    [library.settings.playback.rememberTrackPositions, library.settings.session, persistSessionSettings],
  );

  const playAdjacentTrack = useCallback(
    (direction: 1 | -1) => {
      if (tracks.length === 0) return;

      const selectedTrackId = selectedTrackIds[0] || null;
      let currentIndex = activeTrackId
        ? tracks.findIndex((track) => track.id === activeTrackId)
        : -1;

      if (currentIndex === -1 && selectedTrackId) {
        currentIndex = tracks.findIndex((track) => track.id === selectedTrackId);
      }

      if (shuffleEnabled && tracks.length > 1) {
        const candidates =
          currentIndex === -1 ? tracks : tracks.filter((_, index) => index !== currentIndex);
        const randomIndex = Math.floor(Math.random() * candidates.length);
        void selectTrack(candidates[randomIndex], true, 0, false);
        return;
      }

      const nextIndex =
        currentIndex === -1
          ? direction === -1
            ? tracks.length - 1
            : 0
          : (currentIndex + direction + tracks.length) % tracks.length;

      void selectTrack(tracks[nextIndex], true, 0, false);
    },
    [activeTrackId, selectTrack, selectedTrackIds, shuffleEnabled, tracks],
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

    const currentIndex = tracks.findIndex((track) => track.id === activeTrackId);
    if (shuffleEnabled && tracks.length > 1) {
      const candidates =
        currentIndex === -1 ? tracks : tracks.filter((_, index) => index !== currentIndex);
      const randomIndex = Math.floor(Math.random() * candidates.length);
      void selectTrack(candidates[randomIndex], true);
      return true;
    }

    let nextTrack = currentIndex >= 0 ? tracks[currentIndex + 1] : null;
    if (!nextTrack && repeatMode === "all") nextTrack = tracks[0] || null;
    if (!nextTrack) return false;

    void selectTrack(nextTrack, true);
    return true;
  }, [activeTrackId, repeatMode, selectTrack, shuffleEnabled, tracks]);

  useEffect(() => {
    activeTrackIdRef.current = activeTrackId;
    rememberTrackPositionRef.current = rememberTrackPosition;
    clearTrackPositionRef.current = clearTrackPosition;
  }, [activeTrackId, clearTrackPosition, rememberTrackPosition]);

  useEffect(() => {
    playAdjacentTrackRef.current = () => playAdjacentTrack(1);
  }, [playAdjacentTrack]);

  useEffect(() => {
    if (didLoadLibraryRef.current) return;
    didLoadLibraryRef.current = true;

    void window.playhead.getLibraryState().then((state) => {
      const nextState = normalizeSourceForMode(state);
      setLibrary(nextState);
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
    return window.playhead.onFolderChanged((folderId) => {
      const folder = library.folders.find((item) => item.id === folderId);
      if (!folder) return;

      void window.playhead
        .scanFolder(folder, library.settings.library.enabledAudioExtensions)
        .then((scanned) => persistLibrary(mergeScannedFolder(library, scanned)))
        .catch(() => setError("Could not rescan changed folder."));
    });
  }, [library, persistLibrary]);

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
      barWidth: 2,
      barGap: 3,
      barRadius: 2,
      normalize: true,
      dragToSeek: true,
    });
    wavesurfer.setVolume(volumeRef.current);

    wavesurferRef.current = wavesurfer;
    setIsWaveformEngineReady(true);
    const unsubscribers = [
      wavesurfer.on("ready", (nextDuration) => {
        setDuration(nextDuration || 0);
        setCurrentTime(wavesurfer.getCurrentTime());
        setHasWaveform(true);
        setIsLoadingTrack(false);
      }),
      wavesurfer.on("timeupdate", (time) => {
        setCurrentTime(time);
        const trackId = activeTrackIdRef.current;
        if (!trackId || Date.now() - lastPositionSaveRef.current < 5000) return;
        lastPositionSaveRef.current = Date.now();
        rememberTrackPositionRef.current(trackId, time);
      }),
      wavesurfer.on("seeking", (time) => setCurrentTime(time)),
      wavesurfer.on("play", () => setIsPlaying(true)),
      wavesurfer.on("pause", () => setIsPlaying(false)),
      wavesurfer.on("finish", () => {
        if (activeTrackIdRef.current) clearTrackPositionRef.current(activeTrackIdRef.current);
        if (!playNextTrackOnEndRef.current()) setIsPlaying(false);
      }),
      wavesurfer.on("error", () => {
        setError("This track could not be loaded.");
        setHasWaveform(false);
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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;

      if (
        (event.metaKey || event.ctrlKey) &&
        (event.key.toLowerCase() === "k" || event.key.toLowerCase() === "f")
      ) {
        event.preventDefault();
        setIsSearchOpen(true);
        return;
      }

      const primaryModifier = isMacPlatform() ? event.metaKey : event.ctrlKey;
      if (primaryModifier && event.key === ",") {
        event.preventDefault();
        setIsSettingsOpen(true);
        return;
      }

      if (event.code === "Space" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        void togglePlayback();
        return;
      }

      if (event.code === "ArrowLeft" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        const step = library.settings.playback.seekStepSeconds;
        seekBy(event.shiftKey ? -(step * 2) : -step);
        return;
      }

      if (event.code === "ArrowRight" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        const step = library.settings.playback.seekStepSeconds;
        seekBy(event.shiftKey ? step * 2 : step);
        return;
      }

      if (event.code === "ArrowUp" && primaryModifier && !event.altKey) {
        event.preventDefault();
        const step = library.settings.playback.volumeStepPercent / 100;
        changeVolumeBy(event.shiftKey ? step * 2 : step);
        return;
      }

      if (event.code === "ArrowDown" && primaryModifier && !event.altKey) {
        event.preventDefault();
        const step = library.settings.playback.volumeStepPercent / 100;
        changeVolumeBy(event.shiftKey ? -(step * 2) : -step);
        return;
      }

      if (event.code === "ArrowUp" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        selectAdjacentTrackInList(-1);
        return;
      }

      if (event.code === "ArrowDown" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        selectAdjacentTrackInList(1);
        return;
      }

      if (event.code === "Enter" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        playSelectedTrack();
        return;
      }

      if (
        event.key.toLowerCase() === "l" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        event.preventDefault();
        toggleSelectedTrackFavorite();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    changeVolumeBy,
    library.settings.playback,
    playSelectedTrack,
    seekBy,
    selectAdjacentTrackInList,
    togglePlayback,
    toggleSelectedTrackFavorite,
  ]);

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
        className="app-shell app-drag flex size-full gap-4 overflow-hidden p-4"
        style={{ "--app-transparency": appTransparency } as React.CSSProperties}
      >
        <Sidebar
          folders={library.folders}
          libraryMode={library.settings.library.mode}
          trackCount={libraryTrackCount}
          playlists={library.playlists}
          lovedCount={hasLovedTracks ? library.favoriteTrackIds.length : 0}
          selectedSource={library.selectedSource}
          isScanning={isScanning}
          onAddFolder={addFolder}
          onOpenSearch={() => setIsSearchOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onCreatePlaylist={() => setIsCreatePlaylistOpen(true)}
          onSelectSource={(source) => void persistLibrary({ ...library, selectedSource: source })}
          onDropTrackToPlaylist={(trackId, playlist) => void addTrackToPlaylist(trackId, playlist)}
          onRemoveFolder={(folder) => setFolderPendingRemoval(folder)}
          onRenamePlaylist={(playlist) => setRenamingPlaylistId(playlist.id)}
          onDeletePlaylist={(playlist) => {
            if (playlist.trackIds.length === 0) {
              void deletePlaylist(playlist.id);
              return;
            }
            setPlaylistPendingDeletion(playlist);
          }}
        />

        <main className="no-drag flex min-h-0 min-w-0 flex-1 flex-col gap-[10px]">
          {isLibraryEmpty ? (
            <EmptyLibraryState
              isScanning={isScanning}
              libraryMode={library.settings.library.mode}
              onLibraryModeChange={(mode) => void updateLibraryMode(mode)}
              onAddFolder={addFolder}
              onDropFolderPath={(folderPath) => void addFolderPath(folderPath)}
            />
          ) : (
            <>
              <Player
                activeTrack={activeTrack}
                isPlaying={isPlaying}
                isLoading={isLoadingTrack}
                hasWaveform={hasWaveform}
                reduceMotion={reduceMotion}
                isFavorite={
                  activeTrack ? (library.favoriteTrackIds || []).includes(activeTrack.id) : false
                }
                currentTime={currentTime}
                duration={duration}
                error={error}
                waveformRef={setWaveformElement}
                onTogglePlayback={togglePlayback}
                onPreviousTrack={() => playAdjacentTrack(-1)}
                onNextTrack={() => playAdjacentTrack(1)}
                shuffleEnabled={shuffleEnabled}
                repeatMode={repeatMode}
                volume={volume}
                onToggleShuffle={() => setShuffleEnabled((enabled) => !enabled)}
                onCycleRepeat={() =>
                  setRepeatMode((mode) => (mode === "off" ? "all" : mode === "all" ? "one" : "off"))
                }
                onToggleFavorite={() => {
                  if (activeTrack) void toggleFavoriteTrack(activeTrack.id);
                }}
                onVolumeChange={setPlayerVolume}
              />

              {selectedSource?.type === "library-artists" ? (
                <LibraryBrowser
                  emptyLabel="No artists to show."
                  artists={libraryArtists}
                  onSelectArtist={(artist) =>
                    void persistLibrary({
                      ...library,
                      selectedSource: { type: "library-artist", id: artist.id },
                    })
                  }
                />
              ) : selectedSource?.type === "library-albums" ? (
                <LibraryBrowser
                  emptyLabel="No albums to show."
                  albums={libraryAlbums}
                  onSelectAlbum={(album) =>
                    void persistLibrary({
                      ...library,
                      selectedSource: { type: "library-album", id: album.id },
                    })
                  }
                />
              ) : (
                <TrackList
                  tracks={tracks}
                  activeTrackId={activeTrackId}
                  isPlaying={isPlaying}
                  selectedTrackIds={selectedTrackIds}
                  scrollToTrackId={scrollToTrackId}
                  selectedPlaylist={selectedPlaylist}
                  playlists={library.playlists}
                  favoriteTrackIds={library.favoriteTrackIds || []}
                  onSelectTrack={(track) => setSelectedTrackIds([track.id])}
                  onPlayTrack={(track) => selectTrack(track, true)}
                  onAddToPlaylist={(track, playlist) => addTrackToPlaylist(track.id, playlist)}
                  onCreatePlaylist={(track) => {
                    setTrackPendingPlaylistCreation(track);
                    setIsCreatePlaylistOpen(true);
                  }}
                  onToggleFavorite={(track) => toggleFavoriteTrack(track.id)}
                  onRemoveFromPlaylist={removeTrackFromSelectedPlaylist}
                  onShowInFolder={(track) => window.playhead.showItemInFolder(track.path)}
                  onShowMetadata={(track) => setMetadataDialog({ track })}
                  onReorderTrack={(trackId, targetTrackId, edge) =>
                    reorderTrack(trackId, targetTrackId, edge)
                  }
                  onScrolledToTrack={() => setScrollToTrackId(null)}
                />
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
            libraryMode={library.settings.library.mode}
            onSelectTrack={playSearchResult}
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
            onLibrarySettingsChange={(settings) => void updateLibrarySettings(settings)}
            onRemoveLibraryFolder={setFolderPendingRemoval}
            playbackSettings={library.settings.playback}
            onPlaybackSettingsChange={(settings) => void updatePlaybackSettings(settings)}
            appearanceSettings={library.settings.appearance}
            onAppearanceSettingsChange={(settings) => void updateAppearanceSettings(settings)}
            onAppearancePreviewChange={setPreviewAppTransparency}
            onAdvancedAction={runAdvancedSettingsAction}
            onClose={() => setIsSettingsOpen(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
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
        {isCreatePlaylistOpen && (
          <CreatePlaylistDialog
            key="create-playlist"
            description={
              trackPendingPlaylistCreation
                ? `Name the playlist. ${trackPendingPlaylistCreation.title} will be added to it.`
                : undefined
            }
            onCreate={(name) => void createNewPlaylist(name, trackPendingPlaylistCreation)}
            onClose={() => {
              setIsCreatePlaylistOpen(false);
              setTrackPendingPlaylistCreation(null);
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
      </AnimatePresence>
    </main>
    </MotionConfig>
  );
}
