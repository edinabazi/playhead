import { useEffect, useMemo, useRef, useState } from "react";
import {
  DialogOverlay,
  DialogPanel,
  dialogOverlayMotion,
  dialogPanelMotion,
} from "@/components/ui/dialog-motion";
import type { LibraryAlbum, LibraryArtist } from "@/features/library/library-model";
import { LibraryCollectionContextMenu } from "@/features/library/LibraryBrowser";
import { useIcons } from "@/lib/icon-context";
import type { MenuAnchorPoint } from "@/lib/menu-position";
import type {
  LibraryFolder,
  LibraryMode,
  LibraryPlaylist,
  LibraryTag,
  LibraryTrack,
} from "../../../../shared/library";
import { TrackArtwork } from "@/features/tracks/TrackArtwork";
import { ArtistArtwork } from "@/features/library/ArtistArtwork";
import { TrackRowMenu } from "@/features/tracks/TrackRowMenu";

type SearchResult =
  | { type: "artist"; artist: LibraryArtist }
  | { type: "album"; album: LibraryAlbum }
  | { type: "track"; track: LibraryTrack };

type ScoredSearchResult = {
  result: SearchResult;
  label: string;
  score: number;
};

function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase();
}

function scoreText(text: string, query: string): number {
  if (!text) return Number.POSITIVE_INFINITY;
  if (text === query) return 0;
  if (text.startsWith(query)) return 1;

  let wordIndex = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== " ") continue;
    while (text[index + 1] === " ") index += 1;
    wordIndex += 1;
    if (text.startsWith(query, index + 1)) return 2 + wordIndex / 10;
  }

  const index = text.indexOf(query);
  return index >= 0 ? 4 + index / 100 : Number.POSITIVE_INFINITY;
}

function bestFieldScore(fields: Array<{ value: string; weight: number }>, query: string): number {
  return fields.reduce(
    (best, field) => Math.min(best, scoreText(field.value, query) + field.weight),
    Number.POSITIVE_INFINITY,
  );
}

function bestResults(results: ScoredSearchResult[], limit: number): SearchResult[] {
  return results
    .filter((result) => Number.isFinite(result.score))
    .sort((a, b) => a.score - b.score || a.label.localeCompare(b.label))
    .slice(0, limit)
    .map(({ result }) => result);
}

export function TrackSearchDialog({
  tracks,
  folders,
  artists,
  albums,
  playlists,
  tags,
  libraryMode,
  onSelectTrack,
  onSelectArtist,
  onSelectAlbum,
  onAddToPlaylist,
  onAddTracksToPlaylist,
  onCreatePlaylist,
  onAddTracksToTag,
  onCreateTag,
  onShowInFolder,
  onShowMetadata,
  onClose,
}: {
  tracks: LibraryTrack[];
  folders: LibraryFolder[];
  artists: LibraryArtist[];
  albums: LibraryAlbum[];
  playlists: LibraryPlaylist[];
  tags: LibraryTag[];
  libraryMode: LibraryMode;
  onSelectTrack: (track: LibraryTrack) => void;
  onSelectArtist: (artist: LibraryArtist) => void;
  onSelectAlbum: (album: LibraryAlbum) => void;
  onAddToPlaylist: (track: LibraryTrack, playlist: LibraryPlaylist) => void;
  onAddTracksToPlaylist: (trackIds: string[], playlist: LibraryPlaylist) => void;
  onCreatePlaylist: (tracks: LibraryTrack[]) => void;
  onAddTracksToTag: (tracks: LibraryTrack[], tag: LibraryTag) => void;
  onCreateTag: (tracks: LibraryTrack[]) => void;
  onShowInFolder: (track: LibraryTrack) => void;
  onShowMetadata: (track: LibraryTrack) => void;
  onClose: () => void;
}) {
  const icons = useIcons();
  const MusicIcon = icons.music;
  const ArtistIcon = icons.user;
  const AlbumIcon = icons["square-library"];
  const SearchIcon = icons.search;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const resultRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [contextMenu, setContextMenu] = useState<
    | { type: "track"; track: LibraryTrack; point: MenuAnchorPoint }
    | { type: "collection"; trackIds: string[]; point: MenuAnchorPoint }
    | null
  >(null);
  const folderNames = useMemo(
    () => new Map(folders.map((folder) => [folder.id, folder.name])),
    [folders],
  );
  const searchableTracks = useMemo(
    () =>
      tracks
        .slice()
        .sort((a, b) => a.title.localeCompare(b.title))
        .map((track) => ({
          track,
          label: track.title,
          title: normalizeSearchText(track.title),
          artist: normalizeSearchText(track.artist),
          album: normalizeSearchText(track.album || ""),
          fileName: normalizeSearchText(track.fileName),
          folderName: normalizeSearchText(folderNames.get(track.folderId) || ""),
        })),
    [folderNames, tracks],
  );
  const searchableArtists = useMemo(
    () =>
      artists.map((artist) => ({
        artist,
        label: artist.name,
        name: normalizeSearchText(artist.name),
      })),
    [artists],
  );
  const searchableAlbums = useMemo(
    () =>
      albums.map((album) => ({
        album,
        label: album.title,
        title: normalizeSearchText(album.title),
        artist: normalizeSearchText(album.artist),
      })),
    [albums],
  );
  const results = useMemo<SearchResult[]>(() => {
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) {
      return searchableTracks.slice(0, 24).map(({ track }) => ({ type: "track" as const, track }));
    }

    const trackResults = searchableTracks.map((entry) => ({
      result: { type: "track" as const, track: entry.track },
      label: entry.label,
      score: bestFieldScore(
        [
          { value: entry.title, weight: 0 },
          { value: entry.artist, weight: 3 },
          { value: entry.album, weight: 4 },
          { value: entry.fileName, weight: 5 },
          { value: entry.folderName, weight: 6 },
        ],
        normalizedQuery,
      ),
    }));

    if (libraryMode !== "library") {
      return bestResults(trackResults, 24);
    }

    const artistResults = searchableArtists.map((entry) => ({
      result: { type: "artist" as const, artist: entry.artist },
      label: entry.label,
      score: bestFieldScore([{ value: entry.name, weight: 0 }], normalizedQuery),
    }));

    const albumResults = searchableAlbums.map((entry) => ({
      result: { type: "album" as const, album: entry.album },
      label: entry.label,
      score: bestFieldScore(
        [
          { value: entry.title, weight: 0 },
          { value: entry.artist, weight: 2 },
        ],
        normalizedQuery,
      ),
    }));

    return bestResults([...trackResults, ...artistResults, ...albumResults], 24);
  }, [libraryMode, query, searchableAlbums, searchableArtists, searchableTracks]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    resultRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const activeResult = results[activeIndex] || results[0] || null;

  const selectResult = (result: SearchResult) => {
    if (result.type === "artist") {
      onSelectArtist(result.artist);
      return;
    }
    if (result.type === "album") {
      onSelectAlbum(result.album);
      return;
    }
    onSelectTrack(result.track);
  };

  const openContextMenu = (result: SearchResult, point: MenuAnchorPoint) => {
    if (result.type === "track") {
      setContextMenu({ type: "track", track: result.track, point });
      return;
    }

    setContextMenu({
      type: "collection",
      trackIds: result.type === "artist" ? result.artist.trackIds : result.album.trackIds,
      point,
    });
  };

  return (
    <DialogOverlay
      {...dialogOverlayMotion}
      className="app-modal-overlay fixed inset-0 z-50 flex justify-center bg-black/45 px-6 pt-[12vh]"
      onClick={onClose}
    >
      <DialogPanel
        {...dialogPanelMotion}
        className="no-drag selectable w-[620px] max-w-[calc(100vw-48px)] self-start overflow-hidden rounded-[28px] border border-white/10 bg-[rgba(8,8,8,0.97)] p-2 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex h-12 items-center gap-3 border-b border-white/10 px-3">
          <SearchIcon size={18} strokeWidth={1.8} className="text-muted-foreground" />
          <input
            ref={inputRef}
            className="h-full min-w-0 flex-1 bg-transparent text-[15px] font-medium text-foreground outline-none placeholder:text-muted-foreground"
            value={query}
            placeholder="Search tracks"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                onClose();
                return;
              }
              if (event.key === "ArrowDown" && results.length > 0) {
                event.preventDefault();
                setActiveIndex((index) => Math.min(index + 1, results.length - 1));
                return;
              }
              if (event.key === "ArrowUp" && results.length > 0) {
                event.preventDefault();
                setActiveIndex((index) => Math.max(index - 1, 0));
                return;
              }
              if (event.key === "Enter" && activeResult) {
                event.preventDefault();
                selectResult(activeResult);
              }
            }}
          />
          <span className="rounded-full border border-white/10 px-2 py-1 font-mono text-[10px] text-muted-foreground">
            Cmd K
          </span>
        </div>

        <div className="thin-scrollbar max-h-[420px] overflow-y-auto p-1">
          {results.length === 0 ? (
            <div className="grid h-32 place-items-center text-[13px] text-muted-foreground">
              No tracks found.
            </div>
          ) : (
            results.map((result, index) => {
              const albumArtworkSrc =
                result.type === "album"
                  ? result.album.artwork?.dataUrl || result.album.artwork?.src || null
                  : null;

              return (
                <button
                  key={
                    result.type === "artist"
                      ? `artist-${result.artist.id}`
                      : result.type === "album"
                        ? `album-${result.album.id}`
                        : `track-${result.track.id}`
                  }
                  ref={(node) => {
                    resultRefs.current[index] = node;
                  }}
                  className={`flex w-full items-center gap-3 rounded-[18px] px-3 py-2 text-left transition-colors duration-150 ${
                    index === activeIndex
                      ? "bg-[var(--surface-track-active)]"
                      : "hover:bg-[var(--surface-track-hover)]"
                  }`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setActiveIndex(index);
                    openContextMenu(result, { x: event.clientX, y: event.clientY, align: "left" });
                  }}
                  onClick={() => selectResult(result)}
                >
                  {result.type === "track" ? (
                    <TrackArtwork track={result.track} fallbackIcon={MusicIcon} />
                  ) : result.type === "album" ? (
                    <div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-[12px] bg-white/10">
                      {albumArtworkSrc ? (
                        <img
                          className="size-full object-contain"
                          src={albumArtworkSrc}
                          alt=""
                          draggable={false}
                        />
                      ) : (
                        <AlbumIcon size={18} strokeWidth={1.6} />
                      )}
                    </div>
                  ) : result.type === "artist" ? (
                    <ArtistArtwork artist={result.artist} fallbackIcon={ArtistIcon} />
                  ) : (
                    <div className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-white/10">
                      <AlbumIcon size={18} strokeWidth={1.6} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-semibold leading-[1.2] text-foreground">
                      {result.type === "artist"
                        ? result.artist.name
                        : result.type === "album"
                          ? result.album.title
                          : result.track.title}
                    </div>
                    <div className="mt-1 truncate text-[13px] font-medium leading-[1.2] text-muted-foreground">
                      {result.type === "artist"
                        ? `${result.artist.trackIds.length} ${
                            result.artist.trackIds.length === 1 ? "track" : "tracks"
                          }`
                        : result.type === "album"
                          ? result.album.artist
                          : result.track.artist}
                    </div>
                  </div>
                  {result.type === "track" && libraryMode === "folder" && (
                    <div className="max-w-[170px] truncate text-right text-[12px] font-medium text-[var(--text-tertiary)]">
                      {folderNames.get(result.track.folderId) || "Folder"}
                    </div>
                  )}
                  {result.type === "track" && libraryMode === "library" && (
                    <div className="max-w-[120px] truncate text-right text-[12px] font-medium text-[var(--text-tertiary)]">
                      Track
                    </div>
                  )}
                  {result.type !== "track" && (
                    <div className="max-w-[120px] truncate text-right text-[12px] font-medium text-[var(--text-tertiary)]">
                      {result.type === "artist" ? "Artist" : "Album"}
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </DialogPanel>
      {contextMenu?.type === "track" && (
        <TrackRowMenu
          track={contextMenu.track}
          selectedTracks={[contextMenu.track]}
          playlists={playlists}
          tags={tags}
          selectedPlaylist={null}
          selectedTag={null}
          menuIcon={icons.ellipsis}
          open
          showTrigger={false}
          anchorPoint={contextMenu.point}
          onOpenChange={(open) => {
            if (!open) setContextMenu(null);
          }}
          onAddToPlaylist={onAddToPlaylist}
          onAddTracksToPlaylist={(tracksToAdd, playlist) =>
            onAddTracksToPlaylist(
              tracksToAdd.map((track) => track.id),
              playlist,
            )
          }
          onCreatePlaylist={onCreatePlaylist}
          onAddTracksToTag={onAddTracksToTag}
          onCreateTag={onCreateTag}
          onRemoveFromPlaylist={() => undefined}
          onRemoveFromTag={() => undefined}
          onShowInFolder={onShowInFolder}
          onShowMetadata={(track) => {
            setContextMenu(null);
            onShowMetadata(track);
          }}
          onViewArtist={
            libraryMode === "library"
              ? (track) => {
                  const artist = artists.find((item) => item.trackIds.includes(track.id));
                  if (!artist) return;
                  setContextMenu(null);
                  onSelectArtist(artist);
                }
              : undefined
          }
          onViewAlbum={
            libraryMode === "library"
              ? (track) => {
                  const album = albums.find((item) => item.trackIds.includes(track.id));
                  if (!album) return;
                  setContextMenu(null);
                  onSelectAlbum(album);
                }
              : undefined
          }
        />
      )}
      {contextMenu?.type === "collection" && (
        <LibraryCollectionContextMenu
          point={contextMenu.point}
          trackIds={contextMenu.trackIds}
          playlists={playlists}
          onAddTrackIdsToPlaylist={onAddTracksToPlaylist}
          onClose={() => setContextMenu(null)}
        />
      )}
    </DialogOverlay>
  );
}
