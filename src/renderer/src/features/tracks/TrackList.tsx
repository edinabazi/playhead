import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useIcons } from "@/lib/icon-context";
import { formatTime } from "@/lib/format";
import type { MenuAnchorPoint } from "@/lib/menu-position";
import type { LibraryPlaylist, LibraryTrack } from "../../../../shared/library";
import { FavoriteHeartButton } from "./FavoriteHeartButton";
import { TrackArtwork } from "./TrackArtwork";
import { TrackCell } from "./TrackCell";
import { TrackRowMenu } from "./TrackRowMenu";

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
                    <TrackCell
                      draggable
                      trackId={track.id}
                      selected={selectedTrackIds.includes(track.id)}
                      dragging={draggedTrackIds.includes(track.id)}
                      onClick={(event) => onSelectTrack(track, event)}
                      onDoubleClick={() => onPlayTrack(track)}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        if (!selectedTrackIds.includes(track.id)) onSelectTrack(track);
                        setContextMenuPoint({ x: event.clientX, y: event.clientY, align: "left" });
                        setMenuTrackId(track.id);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") onPlayTrack(track);
                      }}
                      onDragStart={(event) => {
                        const draggedIds = selectedTrackIds.includes(track.id)
                          ? selectedTrackIds
                          : [track.id];
                        const draggedTracks = draggedIds
                          .map((trackId) => tracks.find((item) => item.id === trackId))
                          .filter((item): item is LibraryTrack => Boolean(item));
                        setDraggedTrackIds(draggedIds);
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("application/x-playhead-track-id", track.id);
                        event.dataTransfer.setData(
                          "application/x-playhead-track-ids",
                          JSON.stringify(draggedIds),
                        );
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
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3 pr-6">
                        <div className="relative grid h-4 w-5 shrink-0 place-items-center font-mono text-[12px] font-medium tabular-nums text-muted-foreground">
                          <AnimatePresence initial={false}>
                            {activeTrackId === track.id && isPlaying ? (
                              <motion.span
                                key="active-waveform"
                                className="absolute inset-0 grid place-items-center"
                                initial={{ opacity: 0, x: -3, filter: "blur(3px)" }}
                                animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                                exit={{ opacity: 0, x: 3, filter: "blur(3px)" }}
                                transition={{
                                  x: { type: "spring", stiffness: 520, damping: 36, mass: 0.72 },
                                  opacity: { duration: 0.14 },
                                  filter: { duration: 0.16 },
                                }}
                              >
                                <ActiveTrackIndicator />
                              </motion.span>
                            ) : (
                              <motion.span
                                key="track-number"
                                className="absolute inset-0 grid place-items-center"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{
                                  opacity: { duration: 0.14 },
                                }}
                              >
                                {index + 1}
                              </motion.span>
                            )}
                          </AnimatePresence>
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
                        <FavoriteHeartButton
                          active={isFavorite}
                          tooltipSide="top"
                          onClick={(event) => {
                            event.stopPropagation();
                            void onToggleFavorite(track);
                          }}
                        />
                        <TrackRowMenu
                          track={track}
                          selectedTracks={
                            selectedTrackIds.includes(track.id) ? selectedTracks : [track]
                          }
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
                          onAddTracksToPlaylist={onAddTracksToPlaylist}
                          onCreatePlaylist={onCreatePlaylist}
                          onRemoveFromPlaylist={onRemoveFromPlaylist}
                          onShowInFolder={onShowInFolder}
                          onShowMetadata={onShowMetadata}
                        />
                      </div>
                    </TrackCell>
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

function createTrackStackDragImage(tracks: LibraryTrack[]) {
  const preview = document.createElement("div");
  const visibleTracks = tracks.slice(0, 3);

  Object.assign(preview.style, {
    position: "fixed",
    top: "-1000px",
    left: "-1000px",
    width: "244px",
    height: "72px",
    pointerEvents: "none",
    zIndex: "9999",
  });

  visibleTracks
    .slice()
    .reverse()
    .forEach((track, reversedIndex) => {
      const index = visibleTracks.length - 1 - reversedIndex;
      const card = document.createElement("div");
      const title = document.createElement("div");
      const artist = document.createElement("div");
      const badge = document.createElement("div");

      Object.assign(card.style, {
        position: "absolute",
        inset: "0",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: "3px",
        boxSizing: "border-box",
        padding: "10px 44px 10px 14px",
        border: "1px solid rgba(255, 255, 255, 0.13)",
        borderRadius: "16px",
        background: "rgba(22, 22, 22, 0.94)",
        boxShadow: "0 18px 38px rgba(0, 0, 0, 0.34)",
        color: "white",
        transform: `translate(${index * 7}px, ${index * 6}px) rotate(${(index - 1) * 1.5}deg)`,
        opacity: `${1 - index * 0.14}`,
      });

      Object.assign(title.style, {
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        fontSize: "13px",
        fontWeight: "700",
        lineHeight: "16px",
      });

      Object.assign(artist.style, {
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        color: "rgba(255, 255, 255, 0.62)",
        fontSize: "12px",
        fontWeight: "600",
        lineHeight: "15px",
      });

      Object.assign(badge.style, {
        position: "absolute",
        right: "11px",
        top: "50%",
        display: "grid",
        width: "28px",
        height: "28px",
        placeItems: "center",
        borderRadius: "999px",
        background: "var(--color-primary, #ffff00)",
        color: "black",
        fontSize: "12px",
        fontWeight: "800",
        transform: "translateY(-50%)",
      });

      title.textContent = track.title;
      artist.textContent = track.artist;
      badge.textContent = `${tracks.length}`;
      card.append(title, artist, badge);
      preview.appendChild(card);
    });

  return preview;
}

function getDraggedTrackIds(dataTransfer: DataTransfer) {
  const trackIdsPayload = dataTransfer.getData("application/x-playhead-track-ids");
  const fallbackTrackId = dataTransfer.getData("application/x-playhead-track-id");

  if (!trackIdsPayload) return fallbackTrackId ? [fallbackTrackId] : [];

  try {
    const parsedTrackIds = JSON.parse(trackIdsPayload);
    if (Array.isArray(parsedTrackIds)) {
      return parsedTrackIds.filter((trackId): trackId is string => typeof trackId === "string");
    }
  } catch {
    return fallbackTrackId ? [fallbackTrackId] : [];
  }

  return fallbackTrackId ? [fallbackTrackId] : [];
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
        <span
          key={index}
          className="w-[2px] animate-[active-waveform_2.18s_ease-in-out_infinite] rounded-full bg-current"
          style={{
            height,
            animationDelay: `${[0.22, 0, 0.33, 0.11][index]}s`,
          }}
        />
      ))}
    </span>
  );
}
