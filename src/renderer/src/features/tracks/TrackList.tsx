import { useEffect, useRef, useState } from "react";
import { useIcons } from "@/lib/icon-context";
import { formatTime } from "@/lib/format";
import type { MenuAnchorPoint } from "@/lib/menu-position";
import type { LibraryPlaylist, LibraryTrack } from "../../../../shared/library";
import { TrackArtwork } from "./TrackArtwork";
import { TrackRowMenu } from "./TrackRowMenu";

export function TrackList({
  tracks,
  activeTrackId,
  selectedTrackIds,
  scrollToTrackId,
  selectedPlaylist,
  playlists,
  favoriteTrackIds,
  onSelectTrack,
  onPlayTrack,
  onAddToPlaylist,
  onToggleFavorite,
  onRemoveFromPlaylist,
  onShowInFolder,
  onShowMetadata,
  onReorderTrack,
  onScrolledToTrack,
}: {
  tracks: LibraryTrack[];
  activeTrackId: string | null;
  selectedTrackIds: string[];
  scrollToTrackId: string | null;
  selectedPlaylist: LibraryPlaylist | null;
  playlists: LibraryPlaylist[];
  favoriteTrackIds: string[];
  onSelectTrack: (track: LibraryTrack) => void;
  onPlayTrack: (track: LibraryTrack) => void;
  onAddToPlaylist: (track: LibraryTrack, playlist: LibraryPlaylist) => void;
  onToggleFavorite: (track: LibraryTrack) => void;
  onRemoveFromPlaylist: (trackId: string) => void;
  onShowInFolder: (track: LibraryTrack) => void;
  onShowMetadata: (track: LibraryTrack) => void;
  onReorderTrack: (trackId: string, targetTrackId: string, edge?: "before" | "after") => void;
  onScrolledToTrack: () => void;
}) {
  const icons = useIcons();
  const MusicIcon = icons.music;
  const HeartIcon = icons.heart;
  const MenuIcon = icons.ellipsis;
  const [menuTrackId, setMenuTrackId] = useState<string | null>(null);
  const [contextMenuPoint, setContextMenuPoint] = useState<MenuAnchorPoint | null>(null);
  const [draggedTrackId, setDraggedTrackId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{
    trackId: string;
    edge: "before" | "after";
  } | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!scrollToTrackId) return;

    const row = scrollContainerRef.current?.querySelector<HTMLElement>(
      `[data-track-id="${CSS.escape(scrollToTrackId)}"]`,
    );
    row?.scrollIntoView({ block: "center" });
    onScrolledToTrack();
  }, [onScrolledToTrack, scrollToTrackId, tracks]);

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-[14px]">
      <div ref={scrollContainerRef} className="thin-scrollbar no-drag min-h-0 overflow-y-auto pr-2">
        {tracks.length === 0 ? (
          <div className="flex h-full min-h-[180px] items-center justify-center rounded-[28px] border border-white/10 bg-white/[0.025] text-[14px] text-muted-foreground">
            No tracks to show.
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {tracks.map((track, index) => {
              const isFavorite = favoriteTrackIds.includes(track.id);
              const showBeforeLine =
                dropIndicator?.trackId === track.id && dropIndicator.edge === "before";
              const showAfterLine =
                dropIndicator?.trackId === track.id && dropIndicator.edge === "after";

              return (
                <div key={track.id} className="relative">
                  {showBeforeLine && <DropIndicator />}
                  <div
                    role="button"
                    tabIndex={0}
                    draggable
                    data-track-id={track.id}
                    className={`flex w-full min-w-0 items-center justify-between rounded-[16px] px-[10px] py-[7px] text-left transition-[opacity,background-color,transform] duration-150 ${
                      selectedTrackIds.includes(track.id)
                        ? "bg-[var(--surface-track-active)]"
                        : "hover:bg-[var(--surface-track-hover)]"
                    } ${draggedTrackId === track.id ? "scale-[0.99] opacity-35" : ""}`}
                    onClick={() => onSelectTrack(track)}
                    onDoubleClick={() => onPlayTrack(track)}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      onSelectTrack(track);
                      setContextMenuPoint({ x: event.clientX, y: event.clientY, align: "left" });
                      setMenuTrackId(track.id);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") onSelectTrack(track);
                    }}
                    onDragStart={(event) => {
                      setDraggedTrackId(track.id);
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("application/x-playhead-track-id", track.id);
                    }}
                    onDragEnd={() => {
                      setDraggedTrackId(null);
                      setDropIndicator(null);
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";

                      const rect = event.currentTarget.getBoundingClientRect();
                      const edge = event.clientY < rect.top + rect.height / 2 ? "before" : "after";
                      setDropIndicator({ trackId: track.id, edge });
                    }}
                    onDragLeave={(event) => {
                      if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
                      setDropIndicator((current) =>
                        current?.trackId === track.id ? null : current,
                      );
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      const draggedTrackId = event.dataTransfer.getData(
                        "application/x-playhead-track-id",
                      );
                      if (draggedTrackId) {
                        const edge =
                          dropIndicator?.trackId === track.id ? dropIndicator.edge : "before";
                        void onReorderTrack(draggedTrackId, track.id, edge);
                      }
                      setDraggedTrackId(null);
                      setDropIndicator(null);
                    }}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3 pr-6">
                      <div className="flex w-5 shrink-0 justify-center font-mono text-[12px] font-medium tabular-nums text-muted-foreground">
                        {activeTrackId === track.id ? <ActiveTrackIndicator /> : index + 1}
                      </div>
                      <TrackArtwork track={track} fallbackIcon={MusicIcon} />
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-semibold leading-[1.18]">
                          {track.title}
                        </p>
                        <p className="mt-1 truncate text-[13px] font-medium leading-[1.25] text-muted-foreground">
                          {track.artist}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-4 text-[13px] font-medium tabular-nums text-muted-foreground">
                      <span>{formatTime(track.duration)}</span>
                      <button
                        className={`no-drag transition hover:text-foreground ${
                          isFavorite ? "text-primary" : "text-muted-foreground"
                        }`}
                        title={isFavorite ? "Remove favorite" : "Favorite"}
                        onClick={(event) => {
                          event.stopPropagation();
                          void onToggleFavorite(track);
                        }}
                      >
                        <HeartIcon
                          size={18}
                          strokeWidth={1.7}
                          fill={isFavorite ? "currentColor" : "none"}
                        />
                      </button>
                      <TrackRowMenu
                        track={track}
                        playlists={playlists}
                        selectedPlaylist={selectedPlaylist}
                        menuIcon={MenuIcon}
                        open={menuTrackId === track.id}
                        anchorPoint={menuTrackId === track.id ? contextMenuPoint : null}
                        onOpenChange={(nextOpen, point) => {
                          setContextMenuPoint(point);
                          setMenuTrackId(nextOpen ? track.id : null);
                        }}
                        onAddToPlaylist={onAddToPlaylist}
                        onRemoveFromPlaylist={onRemoveFromPlaylist}
                        onShowInFolder={onShowInFolder}
                        onShowMetadata={onShowMetadata}
                      />
                    </div>
                  </div>
                  {showAfterLine && <DropIndicator />}
                </div>
              );
            })}
          </div>
        )}
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

function ActiveTrackIndicator() {
  return (
    <span className="flex size-4 items-center justify-center gap-[1.5px] text-primary">
      {[5, 10, 7, 13].map((height, index) => (
        <span key={index} className="w-[2px] rounded-full bg-current" style={{ height }} />
      ))}
    </span>
  );
}
