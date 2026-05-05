import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import {
  type EditableTrackMetadata,
  type LibraryPlaylist,
  type LibraryState,
  type LibraryTrack,
} from "../../shared/library";
import { getMediaArtworkSrc } from "@/lib/artwork";
import { isEditableTarget } from "@/lib/dom";
import { moveItem } from "@/lib/list";
import { MetadataDialog, type MetadataDialogState } from "@/features/metadata/MetadataDialog";
import { Player } from "@/features/player/Player";
import { CreatePlaylistDialog } from "@/features/playlists/CreatePlaylistDialog";
import {
  seekAudio,
  setMediaActionHandler,
  updateMediaPosition,
} from "@/features/player/media-session";
import type { RepeatMode } from "@/features/player/types";
import { TrackSearchDialog } from "@/features/search/TrackSearchDialog";
import { Sidebar } from "@/features/sidebar/Sidebar";
import { TrackList } from "@/features/tracks/TrackList";
import { buildPeaks, getCssColor, toArrayBuffer, type Peak } from "@/features/waveform/waveform";
import {
  createPlaylist,
  emptyLibraryState,
  getSourceTracks,
  mergeScannedFolder,
} from "@/features/library/library-model";
import { EmptyLibraryState } from "@/features/library/EmptyLibraryState";

export function App() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioObjectUrlRef = useRef<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const isScrubbingRef = useRef(false);
  const didLoadLibraryRef = useRef(false);

  const [library, setLibrary] = useState<LibraryState>(emptyLibraryState);
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([]);
  const [peaks, setPeaks] = useState<Peak[]>([]);
  const [canvasWidth, setCanvasWidth] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isLoadingTrack, setIsLoadingTrack] = useState(false);
  const [error, setError] = useState("");
  const [metadataDialog, setMetadataDialog] = useState<MetadataDialogState>(null);
  const [shuffleEnabled, setShuffleEnabled] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("off");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCreatePlaylistOpen, setIsCreatePlaylistOpen] = useState(false);
  const [renamingPlaylistId, setRenamingPlaylistId] = useState<string | null>(null);
  const [scrollToTrackId, setScrollToTrackId] = useState<string | null>(null);

  const tracks = useMemo(() => getSourceTracks(library), [library]);
  const allTracks = useMemo(() => Object.values(library.tracks), [library.tracks]);
  const activeTrack = activeTrackId ? library.tracks[activeTrackId] : null;

  const selectedTitle = useMemo(() => {
    const source = library.selectedSource;
    if (!source) return "Library";
    if (source.type === "folder") {
      return library.folders.find((folder) => folder.id === source.id)?.name || "Folder";
    }
    if (source.type === "loved") return "Loved";
    return library.playlists.find((playlist) => playlist.id === source.id)?.name || "Playlist";
  }, [library]);

  const progress = useMemo(() => {
    if (!duration) return 0;
    return Math.min(1, Math.max(0, currentTime / duration));
  }, [currentTime, duration]);

  const persistLibrary = useCallback(async (nextState: LibraryState) => {
    setLibrary(nextState);
    await window.playhead.saveLibraryState(nextState);
    await window.playhead.watchLibraryFolders(nextState.folders);
  }, []);

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);

    const context = canvas.getContext("2d");
    if (!context) return;

    const secondaryText = getCssColor("--text-secondary") || "#a6a6a2";
    const foreground = getCssColor("--foreground") || "#ffffff";
    const primary = getCssColor("--primary") || "#ffff00";

    context.scale(dpr, dpr);
    context.clearRect(0, 0, width, height);

    if (peaks.length === 0) {
      context.fillStyle = secondaryText;
      context.globalAlpha = 0.35;
      context.fillRect(0, height / 2, width, 1);
      context.globalAlpha = 1;
      return;
    }

    const centerY = height / 2;
    const halfHeight = height * 0.42;
    const barWidth = Math.max(1, width / peaks.length);
    const progressX = width * progress;

    peaks.forEach((peak, index) => {
      const x = index * barWidth;
      const top = centerY + peak.min * halfHeight;
      const bottom = centerY + peak.max * halfHeight;
      const barHeight = Math.max(1, bottom - top);

      context.fillStyle = x <= progressX ? foreground : secondaryText;
      context.fillRect(x, top, Math.max(1, barWidth - 1), barHeight);
    });

    context.fillStyle = primary;
    context.fillRect(progressX, 0, 2, height);
  }, [peaks, progress]);

  const seekFromPointer = useCallback(
    (clientX: number) => {
      const canvas = canvasRef.current;
      const audio = audioRef.current;
      if (!canvas || !audio || !duration) return;

      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      audio.currentTime = ratio * duration;
      setCurrentTime(audio.currentTime);
    },
    [duration],
  );

  const waitForAudioMetadata = useCallback((audio: HTMLAudioElement) => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      return Promise.resolve(audio.duration);
    }

    return new Promise<number>((resolve) => {
      const cleanup = () => {
        audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
        audio.removeEventListener("error", handleError);
      };
      const handleLoadedMetadata = () => {
        cleanup();
        resolve(Number.isFinite(audio.duration) ? audio.duration : 0);
      };
      const handleError = () => {
        cleanup();
        resolve(0);
      };

      audio.addEventListener("loadedmetadata", handleLoadedMetadata, { once: true });
      audio.addEventListener("error", handleError, { once: true });
    });
  }, []);

  const selectTrack = useCallback(
    async (track: LibraryTrack, autoplay = true) => {
      const audio = audioRef.current;
      if (!audio) return;

      setIsLoadingTrack(true);
      setError("");
      setActiveTrackId(track.id);
      setPeaks([]);
      setCurrentTime(0);
      setDuration(track.duration || 0);
      setIsPlaying(false);

      try {
        const arrayBuffer = toArrayBuffer(await window.playhead.readAudioFile(track.path));
        const objectUrl = URL.createObjectURL(new Blob([arrayBuffer]));

        if (audioObjectUrlRef.current) URL.revokeObjectURL(audioObjectUrlRef.current);
        audioObjectUrlRef.current = objectUrl;

        audio.pause();
        audio.src = objectUrl;
        audio.load();
        setDuration((await waitForAudioMetadata(audio)) || track.duration || 0);

        const context = new AudioContext();
        const decoded = await context.decodeAudioData(arrayBuffer.slice(0));
        await context.close();

        bufferRef.current = decoded;
        setPeaks(buildPeaks(decoded, canvasWidth || 900));

        if (autoplay) {
          await audio.play();
          setIsPlaying(true);
        }
      } catch {
        setError("This track could not be loaded.");
        bufferRef.current = null;
        setPeaks([]);
      } finally {
        setIsLoadingTrack(false);
      }
    },
    [canvasWidth, waitForAudioMetadata],
  );

  const playSearchResult = useCallback(
    async (track: LibraryTrack) => {
      setSelectedTrackIds([track.id]);
      setScrollToTrackId(track.id);
      setIsSearchOpen(false);
      await persistLibrary({
        ...library,
        selectedSource: { type: "folder", id: track.folderId },
      });
      await selectTrack(track, true);
    },
    [library, persistLibrary, selectTrack],
  );

  const addFolder = useCallback(async () => {
    setIsScanning(true);
    setError("");

    try {
      const scanned = await window.playhead.selectMusicFolder();
      if (!scanned) return;
      const nextState = mergeScannedFolder(library, scanned);
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
        const scanned = await window.playhead.scanFolderPath(folderPath);
        await persistLibrary(mergeScannedFolder(library, scanned));
      } catch {
        setError("Drop a folder that contains audio files.");
      } finally {
        setIsScanning(false);
      }
    },
    [library, persistLibrary],
  );

  const createNewPlaylist = useCallback(async (name: string) => {
    const playlist = createPlaylist(library.playlists, name);
    await persistLibrary({
      ...library,
      playlists: [...library.playlists, playlist],
      selectedSource: { type: "playlist", id: playlist.id },
    });
    setIsCreatePlaylistOpen(false);
  }, [library, persistLibrary]);

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
          ? nextFolders[0]
            ? { type: "folder" as const, id: nextFolders[0].id }
            : library.playlists[0]
              ? { type: "playlist" as const, id: library.playlists[0].id }
              : null
          : library.selectedSource;

      if (activeTrackId && removedTrackIds.has(activeTrackId)) {
        audioRef.current?.pause();
        setActiveTrackId(null);
        setCurrentTime(0);
        setDuration(0);
        setIsPlaying(false);
        setPeaks([]);
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
      const favoriteTrackIds = new Set(library.favoriteTrackIds || []);
      if (favoriteTrackIds.has(trackId)) favoriteTrackIds.delete(trackId);
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
    const audio = audioRef.current;
    if (!audio) return;

    if (!audio.src) {
      const selectedTrack = selectedTrackIds[0] ? library.tracks[selectedTrackIds[0]] : null;
      const nextTrack = activeTrack || selectedTrack || tracks[0];
      if (nextTrack) await selectTrack(nextTrack, true);
      return;
    }

    if (audio.paused) {
      await audio.play();
      setIsPlaying(true);
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }, [activeTrack, library.tracks, selectTrack, selectedTrackIds, tracks]);

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
        void selectTrack(candidates[randomIndex], true);
        return;
      }

      const nextIndex =
        currentIndex === -1
          ? direction === -1
            ? tracks.length - 1
            : 0
          : (currentIndex + direction + tracks.length) % tracks.length;

      void selectTrack(tracks[nextIndex], true);
    },
    [activeTrackId, selectTrack, selectedTrackIds, shuffleEnabled, tracks],
  );

  const playNextTrackOnEnd = useCallback(() => {
    if (!activeTrackId) return false;

    if (repeatMode === "one") {
      const audio = audioRef.current;
      if (!audio) return false;
      audio.currentTime = 0;
      void audio.play().then(() => setIsPlaying(true));
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
    if (didLoadLibraryRef.current) return;
    didLoadLibraryRef.current = true;

    void window.playhead.getLibraryState().then((state) => {
      setLibrary(state);
      void window.playhead.watchLibraryFolders(state.folders);
    });
  }, []);

  useEffect(() => {
    return window.playhead.onFolderChanged((folderId) => {
      const folder = library.folders.find((item) => item.id === folderId);
      if (!folder) return;

      void window.playhead
        .scanFolder(folder)
        .then((scanned) => persistLibrary(mergeScannedFolder(library, scanned)))
        .catch(() => setError("Could not rescan changed folder."));
    });
  }, [library, persistLibrary]);

  useEffect(() => {
    if (!audioRef.current) audioRef.current = new Audio();
    const audio = audioRef.current;

    const syncTime = () => setCurrentTime(audio.currentTime);
    const syncDuration = () => setDuration(audio.duration || 0);

    audio.addEventListener("timeupdate", syncTime);
    audio.addEventListener("loadedmetadata", syncDuration);

    return () => {
      audio.pause();
      if (audioObjectUrlRef.current) URL.revokeObjectURL(audioObjectUrlRef.current);
      audio.removeEventListener("timeupdate", syncTime);
      audio.removeEventListener("loadedmetadata", syncDuration);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      if (!playNextTrackOnEnd()) setIsPlaying(false);
    };

    audio.addEventListener("ended", handleEnded);
    return () => audio.removeEventListener("ended", handleEnded);
  }, [playNextTrackOnEnd]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new ResizeObserver(([entry]) => {
      const width = Math.floor(entry.contentRect.width);
      setCanvasWidth(width);
      if (bufferRef.current) setPeaks(buildPeaks(bufferRef.current, width));
    });

    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    drawWaveform();
  }, [drawWaveform]);

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

      if (event.code === "Space" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        void togglePlayback();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePlayback]);

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
      const audio = audioRef.current;
      if (audio?.paused) void togglePlayback();
    });
    setMediaActionHandler("pause", () => {
      const audio = audioRef.current;
      if (audio && !audio.paused) void togglePlayback();
    });
    setMediaActionHandler("previoustrack", () => playAdjacentTrack(-1));
    setMediaActionHandler("nexttrack", () => playAdjacentTrack(1));
    setMediaActionHandler("seekto", (details) => {
      const audio = audioRef.current;
      if (!audio || typeof details.seekTime !== "number") return;
      setCurrentTime(seekAudio(audio, details.seekTime));
    });
    setMediaActionHandler("seekbackward", (details) => {
      const audio = audioRef.current;
      if (!audio) return;
      setCurrentTime(seekAudio(audio, audio.currentTime - (details.seekOffset || 10)));
    });
    setMediaActionHandler("seekforward", (details) => {
      const audio = audioRef.current;
      if (!audio) return;
      setCurrentTime(seekAudio(audio, audio.currentTime + (details.seekOffset || 10)));
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
  }, [playAdjacentTrack, togglePlayback]);

  const selectedSource = library.selectedSource;
  const selectedPlaylist =
    selectedSource?.type === "playlist"
      ? library.playlists.find((playlist) => playlist.id === selectedSource.id) || null
      : null;
  const hasLovedTracks = (library.favoriteTrackIds || []).some(
    (trackId) => library.tracks[trackId],
  );
  const isLibraryEmpty = library.folders.length === 0 && library.playlists.length === 0 && !hasLovedTracks;

  return (
    <main className="app-window app-drag h-dvh overflow-hidden bg-transparent text-foreground">
      <section className="app-shell app-drag flex size-full gap-4 overflow-hidden p-4">
        <Sidebar
          folders={library.folders}
          playlists={library.playlists}
          lovedCount={hasLovedTracks ? library.favoriteTrackIds.length : 0}
          selectedSource={library.selectedSource}
          isScanning={isScanning}
          onAddFolder={addFolder}
          onCreatePlaylist={() => setIsCreatePlaylistOpen(true)}
          onSelectSource={(source) => void persistLibrary({ ...library, selectedSource: source })}
          onDropTrackToPlaylist={(trackId, playlist) => void addTrackToPlaylist(trackId, playlist)}
          onRemoveFolder={(folder) => void removeFolderFromPlayhead(folder.id)}
          onRenamePlaylist={(playlist) => setRenamingPlaylistId(playlist.id)}
          onDeletePlaylist={(playlist) => void deletePlaylist(playlist.id)}
        />

        <main className="no-drag flex min-w-0 flex-1 flex-col gap-[10px]">
          {isLibraryEmpty ? (
            <EmptyLibraryState
              isScanning={isScanning}
              onAddFolder={addFolder}
              onDropFolderPath={(folderPath) => void addFolderPath(folderPath)}
            />
          ) : (
            <>
              <Player
                activeTrack={activeTrack}
                isPlaying={isPlaying}
                isLoading={isLoadingTrack}
                hasWaveform={peaks.length > 0}
                isFavorite={
                  activeTrack ? (library.favoriteTrackIds || []).includes(activeTrack.id) : false
                }
                currentTime={currentTime}
                duration={duration}
                error={error}
                canvasRef={canvasRef}
                onTogglePlayback={togglePlayback}
                onPreviousTrack={() => playAdjacentTrack(-1)}
                onNextTrack={() => playAdjacentTrack(1)}
                shuffleEnabled={shuffleEnabled}
                repeatMode={repeatMode}
                onToggleShuffle={() => setShuffleEnabled((enabled) => !enabled)}
                onCycleRepeat={() =>
                  setRepeatMode((mode) =>
                    mode === "off" ? "all" : mode === "all" ? "one" : "off",
                  )
                }
                onToggleFavorite={() => {
                  if (activeTrack) void toggleFavoriteTrack(activeTrack.id);
                }}
                onSeekPointer={seekFromPointer}
                onPointerScrubStart={() => {
                  isScrubbingRef.current = true;
                }}
                onPointerScrubMove={() => isScrubbingRef.current}
                onPointerScrubEnd={() => {
                  isScrubbingRef.current = false;
                }}
              />

              <TrackList
                tracks={tracks}
                activeTrackId={activeTrackId}
                selectedTrackIds={selectedTrackIds}
                scrollToTrackId={scrollToTrackId}
                selectedPlaylist={selectedPlaylist}
                playlists={library.playlists}
                favoriteTrackIds={library.favoriteTrackIds || []}
                onSelectTrack={(track) => setSelectedTrackIds([track.id])}
                onPlayTrack={(track) => selectTrack(track, true)}
                onAddToPlaylist={(track, playlist) => addTrackToPlaylist(track.id, playlist)}
                onToggleFavorite={(track) => toggleFavoriteTrack(track.id)}
                onRemoveFromPlaylist={removeTrackFromSelectedPlaylist}
                onShowInFolder={(track) => window.playhead.showItemInFolder(track.path)}
                onShowMetadata={(track) => setMetadataDialog({ track })}
                onReorderTrack={(trackId, targetTrackId, edge) =>
                  reorderTrack(trackId, targetTrackId, edge)
                }
                onScrolledToTrack={() => setScrollToTrackId(null)}
              />
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
            onSelectTrack={playSearchResult}
            onClose={() => setIsSearchOpen(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isCreatePlaylistOpen && (
          <CreatePlaylistDialog
            key="create-playlist"
            onCreate={(name) => void createNewPlaylist(name)}
            onClose={() => setIsCreatePlaylistOpen(false)}
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
  );
}
