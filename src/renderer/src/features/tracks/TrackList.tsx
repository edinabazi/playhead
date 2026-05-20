import { useEffect, useMemo, useState } from "react";
import { useIcons } from "@/lib/icon-context";
import type { MenuAnchorPoint } from "@/lib/menu-position";
import { useVirtualList } from "@/lib/virtual-list";
import type { LibraryPlaylist, LibraryTag, LibraryTrack } from "../../../../shared/library";
import { TrackListRow } from "./TrackListRow";
import {
  createTrackStackDragImage,
  getDraggedTrackIds,
  setDraggedTrackIds as setDraggedTrackIdsPayload,
} from "./track-drag";

const trackRowHeight = 56;

export function TrackList({
  tracks,
  activeTrackId,
  isPlaying,
  selectedTrackIds,
  scrollToTrackId,
  selectedPlaylist,
  selectedTag,
  canReorderTracks = true,
  playlists,
  tags,
  favoriteTrackIds,
  onSelectTrack,
  onPlayTrack,
  onAddToPlaylist,
  onAddTracksToPlaylist,
  onCreatePlaylist,
  onAddTracksToTag,
  onCreateTag,
  onToggleFavorite,
  onRemoveFromPlaylist,
  onRemoveFromTag,
  onShowInFolder,
  onShowMetadata,
  onViewArtist,
  onViewAlbum,
  onReorderTrack,
  onScrolledToTrack,
}: {
  tracks: LibraryTrack[];
  activeTrackId: string | null;
  isPlaying: boolean;
  selectedTrackIds: string[];
  scrollToTrackId: string | null;
  selectedPlaylist: LibraryPlaylist | null;
  selectedTag: LibraryTag | null;
  canReorderTracks?: boolean;
  playlists: LibraryPlaylist[];
  tags: LibraryTag[];
  favoriteTrackIds: string[];
  onSelectTrack: (track: LibraryTrack, event?: React.MouseEvent<HTMLDivElement>) => void;
  onPlayTrack: (track: LibraryTrack) => void;
  onAddToPlaylist: (track: LibraryTrack, playlist: LibraryPlaylist) => void;
  onAddTracksToPlaylist: (tracks: LibraryTrack[], playlist: LibraryPlaylist) => void;
  onCreatePlaylist: (tracks: LibraryTrack[]) => void;
  onAddTracksToTag: (tracks: LibraryTrack[], tag: LibraryTag) => void;
  onCreateTag: (tracks: LibraryTrack[]) => void;
  onToggleFavorite: (track: LibraryTrack) => void;
  onRemoveFromPlaylist: (trackIds: string[]) => void;
  onRemoveFromTag: (trackIds: string[]) => void;
  onShowInFolder: (track: LibraryTrack) => void;
  onShowMetadata: (track: LibraryTrack) => void;
  onViewArtist?: (track: LibraryTrack) => void;
  onViewAlbum?: (track: LibraryTrack) => void;
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
  const trackById = useMemo(() => new Map(tracks.map((track) => [track.id, track])), [tracks]);
  const selectedTrackSet = useMemo(() => new Set(selectedTrackIds), [selectedTrackIds]);
  const favoriteTrackSet = useMemo(() => new Set(favoriteTrackIds), [favoriteTrackIds]);
  const draggedTrackSet = useMemo(() => new Set(draggedTrackIds), [draggedTrackIds]);
  const selectedTracks = useMemo(
    () =>
      selectedTrackIds
        .map((trackId) => trackById.get(trackId))
        .filter((track): track is LibraryTrack => Boolean(track)),
    [selectedTrackIds, trackById],
  );
  const virtualList = useVirtualList({
    itemCount: tracks.length,
    itemHeight: trackRowHeight,
  });
  const { container, containerRef, onScroll, rows, scrollToIndex, totalHeight } = virtualList;

  useEffect(() => {
    if (!scrollToTrackId || !container) return;

    const index = tracks.findIndex((track) => track.id === scrollToTrackId);
    if (index >= 0) scrollToIndex(index, "center");
    onScrolledToTrack();
  }, [container, onScrolledToTrack, scrollToIndex, scrollToTrackId, tracks]);

  return (
    <section className="-mb-4 flex min-h-0 flex-1 flex-col gap-[14px]">
      <div className="relative min-h-0 flex-1">
        <div
          ref={containerRef}
          className="thin-scrollbar no-drag h-full min-h-0 overflow-y-auto pr-2"
          onScroll={onScroll}
        >
          {tracks.length === 0 ? (
            <div className="flex h-[calc(100%-1rem)] min-h-[180px] items-center justify-center rounded-[28px] border border-white/10 bg-white/[0.025] text-[14px] text-muted-foreground">
              No tracks here yet. Start by adding something.
            </div>
          ) : (
            <div className="relative" style={{ height: totalHeight + 32 }}>
              {rows.map(({ index, start }) => {
                const track = tracks[index];
                if (!track) return null;

                const isFavorite = favoriteTrackSet.has(track.id);
                const isSelected = selectedTrackSet.has(track.id);
                const showBeforeLine =
                  dropIndicator?.trackId === track.id && dropIndicator.edge === "before";
                const showAfterLine =
                  dropIndicator?.trackId === track.id && dropIndicator.edge === "after";

                return (
                  <div key={track.id} className="absolute inset-x-0" style={{ top: start }}>
                    {showBeforeLine && <DropIndicator />}
                    <TrackListRow
                      track={track}
                      index={index}
                      activeTrackId={activeTrackId}
                      isPlaying={isPlaying}
                      selected={isSelected}
                      dragging={draggedTrackSet.has(track.id)}
                      favorite={isFavorite}
                      selectedTracks={isSelected ? selectedTracks : [track]}
                      selectedPlaylist={selectedPlaylist}
                      selectedTag={selectedTag}
                      playlists={playlists}
                      tags={tags}
                      menuOpen={menuTrackId === track.id}
                      menuAnchorPoint={menuTrackId === track.id ? contextMenuPoint : null}
                      menuIcon={MenuIcon}
                      artworkFallbackIcon={MusicIcon}
                      onSelect={onSelectTrack}
                      onPlay={onPlayTrack}
                      onContextMenu={(nextTrack, point) => {
                        if (!selectedTrackSet.has(track.id)) onSelectTrack(track);
                        setContextMenuPoint(point);
                        setMenuTrackId(nextTrack.id);
                      }}
                      onKeyPlay={onPlayTrack}
                      onDragStart={(dragTrack, event) => {
                        const draggedIds = selectedTrackSet.has(dragTrack.id)
                          ? selectedTrackIds
                          : [dragTrack.id];
                        const draggedTracks = draggedIds
                          .map((trackId) => trackById.get(trackId))
                          .filter((item): item is LibraryTrack => Boolean(item));
                        setDraggedTrackIds(draggedIds);
                        event.dataTransfer.effectAllowed = "copyMove";
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
                      onAddTracksToTag={onAddTracksToTag}
                      onCreateTag={onCreateTag}
                      onRemoveFromPlaylist={onRemoveFromPlaylist}
                      onRemoveFromTag={onRemoveFromTag}
                      onShowInFolder={onShowInFolder}
                      onShowMetadata={onShowMetadata}
                      onViewArtist={onViewArtist}
                      onViewAlbum={onViewAlbum}
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
