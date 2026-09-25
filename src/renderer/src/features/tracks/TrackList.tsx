import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useIcons } from "@/lib/icon-context";
import type { MenuAnchorPoint } from "@/lib/menu-position";
import { useVirtualList } from "@/lib/virtual-list";
import type { LibraryPlaylist, LibraryTag, LibraryTrack } from "../../../../shared/library";
import { TrackListRow } from "./TrackListRow";
import type { TrackListSettings, TrackColumnWidths } from "../../../../shared/track-list";
import { getTrackListLayout } from "./track-columns";
import { TrackListHeader } from "./TrackListHeader";
import {
  createTrackStackDragImage,
  getDraggedTrackIds,
  setDraggedTrackIds as setDraggedTrackIdsPayload,
} from "./track-drag";

const trackRowHeight = 56;

function LoadingTracksText() {
  const text = "Loading tracks...";

  return (
    <span className="thinking-title" aria-label={text}>
      <span className="thinking-title-base" aria-hidden="true">
        {text}
      </span>
      <span className="thinking-title-shine" aria-hidden="true">
        {text}
      </span>
    </span>
  );
}

export function TrackList({
  tracks,
  settings,
  onSettingsChange,
  activeTrackId,
  isPlaying,
  selectedTrackIds,
  scrollKey,
  initialScrollTop = 0,
  scrollToTrackId,
  selectedPlaylist,
  selectedTag,
  canReorderTracks = true,
  isLoading = false,
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
  onScrollPositionChange,
  onScrolledToTrack,
}: {
  tracks: LibraryTrack[];
  settings: TrackListSettings;
  onSettingsChange: (settings: TrackListSettings) => void;
  activeTrackId: string | null;
  isPlaying: boolean;
  selectedTrackIds: string[];
  scrollKey: string;
  initialScrollTop?: number;
  scrollToTrackId: string | null;
  selectedPlaylist: LibraryPlaylist | null;
  selectedTag: LibraryTag | null;
  canReorderTracks?: boolean;
  isLoading?: boolean;
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
  onScrollPositionChange: (scrollTop: number) => void;
  onScrolledToTrack: () => void;
}) {
  const [previewWidths, setPreviewWidths] = useState<TrackColumnWidths | null>(null);
  const layout = getTrackListLayout(settings.columns, previewWidths ?? settings.widths);
  const canReorder = canReorderTracks && !settings.sort;
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
  const {
    container,
    containerRef,
    onScroll: onVirtualScroll,
    rows,
    scrollToIndex,
    scrollToOffset,
    totalHeight,
  } = virtualList;

  useEffect(() => {
    if (!container || scrollToTrackId) return;
    scrollToOffset(initialScrollTop);
  }, [container, initialScrollTop, scrollKey, scrollToOffset, scrollToTrackId]);

  useEffect(() => {
    if (!scrollToTrackId || !container) return;

    const index = tracks.findIndex((track) => track.id === scrollToTrackId);
    if (index >= 0) {
      scrollToIndex(index, "center");
      window.requestAnimationFrame(() => onScrollPositionChange(container.scrollTop));
    }
    onScrolledToTrack();
  }, [
    container,
    onScrollPositionChange,
    onScrolledToTrack,
    scrollToIndex,
    scrollToTrackId,
    tracks,
  ]);

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    onVirtualScroll(event);
    onScrollPositionChange(event.currentTarget.scrollTop);
  };

  return (
    <section className="-mb-4 flex min-h-0 flex-1 flex-col">
      <div className="thin-scrollbar no-drag flex min-h-0 flex-1 overflow-x-auto">
        <div
          role="table"
          aria-label="Tracks"
          aria-rowcount={tracks.length + 1}
          className="flex min-h-0 flex-1 flex-col"
          style={{ minWidth: layout.minWidth }}
        >
          <TrackListHeader
            settings={settings}
            onPreviewWidths={setPreviewWidths}
            gridTemplateColumns={layout.gridTemplateColumns}
            onChange={(next) => {
              if (
                next.sort?.column !== settings.sort?.column ||
                next.sort?.direction !== settings.sort?.direction
              ) {
                scrollToOffset(0);
                onScrollPositionChange(0);
              }
              onSettingsChange(next);
            }}
          />
          <div
            ref={containerRef}
            role="rowgroup"
            className="thin-scrollbar no-drag min-h-0 flex-1 overflow-y-auto pr-2"
            onScroll={handleScroll}
          >
            {tracks.length === 0 ? (
              <div className="flex h-[calc(100%-1rem)] min-h-[180px] items-center justify-center rounded-[28px] border border-white/10 bg-white/[0.025] text-[14px] text-muted-foreground">
                {isLoading ? (
                  <LoadingTracksText />
                ) : (
                  "No tracks here yet. Start by adding something."
                )}
              </div>
            ) : (
              <motion.div
                key={
                  settings.sort ? `${settings.sort.column}:${settings.sort.direction}` : "source"
                }
                className="relative"
                style={{ height: totalHeight + 32 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.14 }}
              >
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
                        columns={settings.columns}
                        gridTemplateColumns={layout.gridTemplateColumns}
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
                          if (!canReorder) return;
                          event.preventDefault();
                          event.dataTransfer.dropEffect = "move";

                          const rect = event.currentTarget.getBoundingClientRect();
                          const edge =
                            event.clientY < rect.top + rect.height / 2 ? "before" : "after";
                          setDropIndicator({ trackId: track.id, edge });
                        }}
                        onDragLeave={(event) => {
                          if (!canReorder) return;
                          if (event.currentTarget.contains(event.relatedTarget as Node | null))
                            return;
                          setDropIndicator((current) =>
                            current?.trackId === track.id ? null : current,
                          );
                        }}
                        onDrop={(event) => {
                          if (!canReorder) return;
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
              </motion.div>
            )}
          </div>
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
