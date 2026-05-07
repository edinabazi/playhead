import { useCallback, useEffect, useRef, useState } from "react";
import { useIcons } from "@/lib/icon-context";
import type { MenuAnchorPoint } from "@/lib/menu-position";
import type { LibraryPlaylist, LibraryTrack } from "../../../../shared/library";
import { TrackListRow } from "./TrackListRow";
import {
  createTrackStackDragImage,
  getDraggedTrackIds,
  setDraggedTrackIds as setDraggedTrackIdsPayload,
} from "./track-drag";

export function TrackList({
  tracks,
  activeTrackId,
  isPlaying,
  selectedTrackIds,
  scrollToTrackId,
  selectedPlaylist,
  canReorderTracks = true,
  playlists,
  favoriteTrackIds,
  onSelectTrack,
  onPlayTrack,
  onAddToPlaylist,
  onAddTracksToPlaylist,
  onCreatePlaylist,
  onToggleFavorite,
  onRemoveFromPlaylist,
  onShowInFolder,
  onShowMetadata,
  onReorderTrack,
  onScrolledToTrack,
}: {
  tracks: LibraryTrack[];
  activeTrackId: string | null;
  isPlaying: boolean;
  selectedTrackIds: string[];
  scrollToTrackId: string | null;
  selectedPlaylist: LibraryPlaylist | null;
  canReorderTracks?: boolean;
  playlists: LibraryPlaylist[];
  favoriteTrackIds: string[];
  onSelectTrack: (track: LibraryTrack, event?: React.MouseEvent<HTMLDivElement>) => void;
  onPlayTrack: (track: LibraryTrack) => void;
  onAddToPlaylist: (track: LibraryTrack, playlist: LibraryPlaylist) => void;
  onAddTracksToPlaylist: (tracks: LibraryTrack[], playlist: LibraryPlaylist) => void;
  onCreatePlaylist: (track: LibraryTrack) => void;
  onToggleFavorite: (track: LibraryTrack) => void;
  onRemoveFromPlaylist: (trackId: string) => void;
  onShowInFolder: (track: LibraryTrack) => void;
  onShowMetadata: (track: LibraryTrack) => void;
  onReorderTrack: (trackIds: string[], targetTrackId: string, edge?: "before" | "after") => void;
  onScrolledToTrack: () => void;
}) {
  const icons = useIcons();
  const MusicIcon = icons.music;
  const MenuIcon = icons.ellipsis;
  const [menuTrackId, setMenuTrackId] = useState<string | null>(null);
  const [contextMenuPoint, setContextMenuPoint] = useState<MenuAnchorPoint | null>(null);
  const [draggedTrackIds, setDraggedTrackIds] = useState<string[]>([]);
  const [dropIndicator, setDropIndicator] = useState<{
    trackId: string;
    edge: "before" | "after";
  } | null>(null);
  const [hasBottomFade, setHasBottomFade] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const selectedTracks = selectedTrackIds
    .map((trackId) => tracks.find((track) => track.id === trackId))
    .filter((track): track is LibraryTrack => Boolean(track));

  const updateBottomFade = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const remainingScroll = container.scrollHeight - container.scrollTop - container.clientHeight;
    setHasBottomFade(remainingScroll > 2);
  }, []);

  useEffect(() => {
    if (!scrollToTrackId) return;

    const row = scrollContainerRef.current?.querySelector<HTMLElement>(
      `[data-track-id="${CSS.escape(scrollToTrackId)}"]`,
    );
    row?.scrollIntoView({ block: "center" });
    onScrolledToTrack();
  }, [onScrolledToTrack, scrollToTrackId, tracks]);

  useEffect(() => {
    updateBottomFade();

    const container = scrollContainerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(updateBottomFade);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, [tracks, updateBottomFade]);

  return (
    <section className="-mb-4 flex min-h-0 flex-1 flex-col gap-[14px]">
      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollContainerRef}
          className="thin-scrollbar no-drag h-full min-h-0 overflow-y-auto pr-2"
          onScroll={updateBottomFade}
        >
          {tracks.length === 0 ? (
            <div className="flex h-full min-h-[180px] items-center justify-center rounded-[28px] border border-white/10 bg-white/[0.025] text-[14px] text-muted-foreground">
              No tracks to show.
            </div>
          ) : (
            <div className="flex flex-col gap-0.5 pb-8">
              {tracks.map((track, index) => {
                const isFavorite = favoriteTrackIds.includes(track.id);
                const showBeforeLine =
                  dropIndicator?.trackId === track.id && dropIndicator.edge === "before";
                const showAfterLine =
                  dropIndicator?.trackId === track.id && dropIndicator.edge === "after";

                return (
                  <div key={track.id} className="relative">
                    {showBeforeLine && <DropIndicator />}
                    <TrackListRow
                      track={track}
                      index={index}
                      activeTrackId={activeTrackId}
                      isPlaying={isPlaying}
                      selected={selectedTrackIds.includes(track.id)}
                      dragging={draggedTrackIds.includes(track.id)}
                      favorite={isFavorite}
                      selectedTracks={selectedTrackIds.includes(track.id) ? selectedTracks : [track]}
                      selectedPlaylist={selectedPlaylist}
                      playlists={playlists}
                      menuOpen={menuTrackId === track.id}
                      menuAnchorPoint={menuTrackId === track.id ? contextMenuPoint : null}
                      menuIcon={MenuIcon}
                      artworkFallbackIcon={MusicIcon}
                      onSelect={onSelectTrack}
                      onPlay={onPlayTrack}
                      onContextMenu={(nextTrack, point) => {
                        if (!selectedTrackIds.includes(track.id)) onSelectTrack(track);
                        setContextMenuPoint(point);
                        setMenuTrackId(nextTrack.id);
                      }}
                      onKeyPlay={onPlayTrack}
                      onDragStart={(dragTrack, event) => {
                        const draggedIds = selectedTrackIds.includes(dragTrack.id)
                          ? selectedTrackIds
                          : [dragTrack.id];
                        const draggedTracks = draggedIds
                          .map((trackId) => tracks.find((item) => item.id === trackId))
                          .filter((item): item is LibraryTrack => Boolean(item));
                        setDraggedTrackIds(draggedIds);
                        event.dataTransfer.effectAllowed = "move";
                        setDraggedTrackIdsPayload(event.dataTransfer, draggedIds, dragTrack.id);
                        if (draggedTracks.length > 1) {
                          const dragImage = createTrackStackDragImage(draggedTracks);
                          document.body.appendChild(dragImage);
                          event.dataTransfer.setDragImage(dragImage, 26, 24);
                          window.setTimeout(() => dragImage.remove(), 0);
                        }
                      }}
                      onDragEnd={() => {
                        setDraggedTrackIds([]);
                        setDropIndicator(null);
                      }}
                      onToggleFavorite={onToggleFavorite}
                      onMenuOpenChange={(nextOpen, point) => {
                        setContextMenuPoint(point);
                        setMenuTrackId(nextOpen ? track.id : null);
                      }}
                      onAddToPlaylist={onAddToPlaylist}
                      onAddTracksToPlaylist={onAddTracksToPlaylist}
                      onCreatePlaylist={onCreatePlaylist}
                      onRemoveFromPlaylist={onRemoveFromPlaylist}
                      onShowInFolder={onShowInFolder}
                      onShowMetadata={onShowMetadata}
                      onDragOver={(event) => {
                        if (!canReorderTracks) return;
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";

                        const rect = event.currentTarget.getBoundingClientRect();
                        const edge =
                          event.clientY < rect.top + rect.height / 2 ? "before" : "after";
                        setDropIndicator({ trackId: track.id, edge });
                      }}
                      onDragLeave={(event) => {
                        if (!canReorderTracks) return;
                        if (event.currentTarget.contains(event.relatedTarget as Node | null))
                          return;
                        setDropIndicator((current) =>
                          current?.trackId === track.id ? null : current,
                        );
                      }}
                      onDrop={(event) => {
                        if (!canReorderTracks) return;
                        event.preventDefault();
                        const draggedTrackIds = getDraggedTrackIds(event.dataTransfer);
                        if (draggedTrackIds.length > 0) {
                          const edge =
                            dropIndicator?.trackId === track.id ? dropIndicator.edge : "before";
                          void onReorderTrack(draggedTrackIds, track.id, edge);
                        }
                        setDraggedTrackIds([]);
                        setDropIndicator(null);
                      }}
                    />
                    {showAfterLine && <DropIndicator />}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div
          className={`pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-background/20 backdrop-blur-md transition-opacity duration-200 [mask-image:linear-gradient(to_bottom,transparent,black_70%)] ${
            hasBottomFade ? "opacity-100" : "opacity-0"
          }`}
        />
      </div>
    </section>
  );
}

function DropIndicator() {
  return (
    <div className="pointer-events-none relative z-20 h-0">
      <div className="absolute -top-px left-2 right-2 h-0.5 rounded-full bg-primary" />
    </div>
  );
}
