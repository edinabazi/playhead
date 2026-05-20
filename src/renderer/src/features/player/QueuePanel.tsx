import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { useIcons } from "@/lib/icon-context";
import { useVirtualList } from "@/lib/virtual-list";
import {
  panelContentVariants,
  panelItemVariants,
  panelSectionVariants,
} from "@/lib/motion-variants";
import type { LibraryTrack, PlaybackQueueItem } from "../../../../shared/library";
import { TrackArtwork } from "@/features/tracks/TrackArtwork";
import { TrackCell } from "@/features/tracks/TrackCell";
import {
  getDraggedQueueItemIds,
  getDraggedTrackIds,
  hasDraggedQueueItemIds,
  hasDraggedTrackIds,
  setDraggedQueueItemIds,
} from "@/features/tracks/track-drag";
import type { QueueDropEdge } from "./queue-model";

const queueRowHeight = 56;

export function QueuePanel({
  items,
  tracksById,
  activeItemId,
  onPlayItem,
  onReorderItems,
  onAddTracks,
  onRemoveItem,
}: {
  items: PlaybackQueueItem[];
  tracksById: Record<string, LibraryTrack>;
  activeItemId: string | null;
  onPlayItem: (item: PlaybackQueueItem) => void;
  onReorderItems: (itemIds: string[], targetItemId: string, edge: QueueDropEdge) => void;
  onAddTracks: (trackIds: string[], targetItemId: string | null, edge: QueueDropEdge) => void;
  onRemoveItem: (item: PlaybackQueueItem) => void;
}) {
  const icons = useIcons();
  const MusicIcon = icons.music;
  const XIcon = icons.x;
  const [draggedItemIds, setDraggedItemIds] = useState<string[]>([]);
  const [dropIndicator, setDropIndicator] = useState<{
    itemId: string;
    edge: QueueDropEdge;
  } | null>(null);
  const validItems = useMemo(
    () => items.filter((item) => tracksById[item.trackId]),
    [items, tracksById],
  );
  const draggedItemSet = useMemo(() => new Set(draggedItemIds), [draggedItemIds]);
  const activeIndex = useMemo(
    () => validItems.findIndex((item) => item.id === activeItemId),
    [activeItemId, validItems],
  );
  const activeItem = activeIndex >= 0 ? validItems[activeIndex] : validItems[0] || null;
  const upcomingItems = useMemo(
    () => (activeIndex >= 0 ? validItems.slice(activeIndex + 1) : validItems.slice(1)),
    [activeIndex, validItems],
  );
  const activeTrack = activeItem ? tracksById[activeItem.trackId] : null;
  const upcomingList = useVirtualList({
    itemCount: upcomingItems.length,
    itemHeight: queueRowHeight,
  });
  const appendDroppedItems = (event: React.DragEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement | null)?.closest("[data-queue-now-playing='true']")) {
      return;
    }

    const queueItemIds = getDraggedQueueItemIds(event.dataTransfer);
    const trackIds = getDraggedTrackIds(event.dataTransfer);
    if (trackIds.length === 0 && queueItemIds.length === 0) return;

    event.preventDefault();
    const lastItem = validItems[validItems.length - 1] || null;
    if (queueItemIds.length > 0 && lastItem) {
      onReorderItems(queueItemIds, lastItem.id, "after");
      return;
    }
    if (trackIds.length > 0) onAddTracks(trackIds, lastItem?.id || null, "after");
  };
  const allowDrop = (event: React.DragEvent<HTMLDivElement>) => {
    const hasTracks = hasDraggedTrackIds(event.dataTransfer);
    const hasQueueItems = hasDraggedQueueItemIds(event.dataTransfer);
    if (!hasTracks && !hasQueueItems) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = hasQueueItems ? "move" : "copy";
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col no-drag">
      <div
        className="flex min-h-0 flex-1 flex-col"
        onDragOver={allowDrop}
        onDrop={appendDroppedItems}
      >
        {validItems.length === 0 || !activeItem || !activeTrack ? (
          <motion.div
            className="flex h-full min-h-[180px] items-center justify-center rounded-[22px] border border-dashed border-white/12 bg-white/[0.025] px-5 text-center text-[13px] font-medium leading-normal text-muted-foreground"
            initial={{ opacity: 0, y: 8, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{
              type: "spring",
              stiffness: 520,
              damping: 38,
              mass: 0.76,
              opacity: { duration: 0.16 },
              filter: { duration: 0.18 },
            }}
          >
            Drop tracks here to build a queue.
          </motion.div>
        ) : (
          <motion.div
            className="flex min-h-0 flex-1 flex-col gap-4 pb-4"
            variants={panelContentVariants}
            initial="hidden"
            animate="show"
          >
            <motion.div className="flex flex-col gap-0.5" variants={panelSectionVariants}>
              <SectionLabel>Now Playing</SectionLabel>
              <QueueRow
                item={activeItem}
                nowPlaying
                selected={false}
                removable={false}
                track={activeTrack}
                fallbackIcon={MusicIcon}
                removeIcon={XIcon}
                showBeforeLine={false}
                showAfterLine={false}
                onPlayItem={onPlayItem}
                onRemoveItem={onRemoveItem}
                onReorderItems={onReorderItems}
                onAddTracks={onAddTracks}
                setDraggedItemIds={setDraggedItemIds}
                setDropIndicator={setDropIndicator}
                dragging={draggedItemSet.has(activeItem.id)}
              />
            </motion.div>

            <motion.div
              className="flex min-h-0 flex-1 flex-col gap-0.5"
              variants={panelSectionVariants}
            >
              <SectionLabel>Up Next</SectionLabel>
              {upcomingItems.length === 0 ? (
                <motion.div
                  className="rounded-[18px] border border-dashed border-white/10 bg-white/[0.025] px-4 py-5 text-center text-[13px] font-medium text-muted-foreground"
                  variants={panelItemVariants}
                >
                  No upcoming tracks.
                </motion.div>
              ) : (
                <div
                  ref={upcomingList.containerRef}
                  className="thin-scrollbar -mx-2 min-h-0 flex-1 overflow-y-auto px-2"
                  onScroll={upcomingList.onScroll}
                  onDragOver={allowDrop}
                  onDrop={appendDroppedItems}
                >
                  <div className="relative" style={{ height: upcomingList.totalHeight }}>
                    {upcomingList.rows.map(({ index, start }) => {
                      const item = upcomingItems[index];
                      const track = item ? tracksById[item.trackId] : null;
                      if (!item || !track) return null;

                      const showBeforeLine =
                        dropIndicator?.itemId === item.id && dropIndicator.edge === "before";
                      const showAfterLine =
                        dropIndicator?.itemId === item.id && dropIndicator.edge === "after";

                      return (
                        <div key={item.id} className="absolute inset-x-0" style={{ top: start }}>
                          <QueueRow
                            item={item}
                            selected={false}
                            removable
                            track={track}
                            fallbackIcon={MusicIcon}
                            removeIcon={XIcon}
                            dragging={draggedItemSet.has(item.id)}
                            showBeforeLine={showBeforeLine}
                            showAfterLine={showAfterLine}
                            onPlayItem={onPlayItem}
                            onRemoveItem={onRemoveItem}
                            onReorderItems={onReorderItems}
                            onAddTracks={onAddTracks}
                            setDraggedItemIds={setDraggedItemIds}
                            setDropIndicator={setDropIndicator}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[13px] font-semibold leading-normal text-[var(--text-tertiary)]">
      {children}
    </h3>
  );
}

function QueueRow({
  item,
  nowPlaying = false,
  selected,
  removable,
  track,
  fallbackIcon,
  removeIcon: RemoveIcon,
  dragging,
  showBeforeLine,
  showAfterLine,
  onPlayItem,
  onRemoveItem,
  onReorderItems,
  onAddTracks,
  setDraggedItemIds,
  setDropIndicator,
}: {
  item: PlaybackQueueItem;
  nowPlaying?: boolean;
  selected: boolean;
  removable: boolean;
  track: LibraryTrack;
  fallbackIcon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  removeIcon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  dragging: boolean;
  showBeforeLine: boolean;
  showAfterLine: boolean;
  onPlayItem: (item: PlaybackQueueItem) => void;
  onRemoveItem: (item: PlaybackQueueItem) => void;
  onReorderItems: (itemIds: string[], targetItemId: string, edge: QueueDropEdge) => void;
  onAddTracks: (trackIds: string[], targetItemId: string | null, edge: QueueDropEdge) => void;
  setDraggedItemIds: React.Dispatch<React.SetStateAction<string[]>>;
  setDropIndicator: React.Dispatch<
    React.SetStateAction<{ itemId: string; edge: QueueDropEdge } | null>
  >;
}) {
  return (
    <motion.div
      layout="position"
      className="relative -mx-2 w-[calc(100%+16px)]"
      variants={panelItemVariants}
    >
      {showBeforeLine && <DropIndicator />}
      <TrackCell
        draggable={!nowPlaying}
        trackId={track.id}
        dataQueueNowPlaying={nowPlaying || undefined}
        selected={selected}
        dragging={dragging}
        className="relative overflow-hidden"
        onDoubleClick={() => onPlayItem(item)}
        onDragStart={
          nowPlaying
            ? undefined
            : (event) => {
                setDraggedItemIds([item.id]);
                event.dataTransfer.effectAllowed = "copyMove";
                setDraggedQueueItemIds(event.dataTransfer, [item.id], item.id);
              }
        }
        onDragEnd={
          nowPlaying
            ? undefined
            : () => {
                setDraggedItemIds([]);
                setDropIndicator(null);
              }
        }
        onDragOver={
          nowPlaying
            ? undefined
            : (event) => {
                const hasQueueItems = hasDraggedQueueItemIds(event.dataTransfer);
                const hasTracks = hasDraggedTrackIds(event.dataTransfer);
                if (!hasQueueItems && !hasTracks) return;
                event.preventDefault();
                event.stopPropagation();
                event.dataTransfer.dropEffect = hasQueueItems ? "move" : "copy";

                const rect = event.currentTarget.getBoundingClientRect();
                const edge = event.clientY < rect.top + rect.height / 2 ? "before" : "after";
                setDropIndicator({ itemId: item.id, edge });
              }
        }
        onDragLeave={
          nowPlaying
            ? undefined
            : (event) => {
                if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
                setDropIndicator((current) => (current?.itemId === item.id ? null : current));
              }
        }
        onDrop={
          nowPlaying
            ? undefined
            : (event) => {
                event.preventDefault();
                event.stopPropagation();
                const queueItemIds = getDraggedQueueItemIds(event.dataTransfer);
                const edge = showAfterLine ? "after" : "before";
                if (queueItemIds.length > 0) {
                  onReorderItems(queueItemIds, item.id, edge);
                } else {
                  const trackIds = getDraggedTrackIds(event.dataTransfer);
                  if (trackIds.length > 0) onAddTracks(trackIds, item.id, edge);
                }
                setDraggedItemIds([]);
                setDropIndicator(null);
              }
        }
      >
        <div className="flex min-w-0 flex-1 items-center gap-3 pr-0">
          <div className="relative shrink-0">
            <TrackArtwork track={track} fallbackIcon={fallbackIcon} />
            {nowPlaying && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center rounded-[12px] bg-black/38 text-primary">
                <NowPlayingIndicator />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold leading-[1.18]">{track.title}</p>
            <p className="mt-0.5 truncate text-[13px] font-medium leading-[1.25] text-muted-foreground">
              {track.artist}
            </p>
          </div>
        </div>
        {removable && (
          <div className="pointer-events-none absolute inset-y-0 right-0 flex w-1/2 items-center justify-end rounded-r-2xl bg-transparent pr-2 opacity-0 group-hover:opacity-100">
            <button
              type="button"
              className="pointer-events-auto grid size-6 place-items-center rounded-full bg-transparent text-muted-foreground transition hover:bg-white/[0.14] hover:text-foreground"
              aria-label="Remove from queue"
              onClick={(event) => {
                event.stopPropagation();
                onRemoveItem(item);
              }}
            >
              <RemoveIcon size={15} strokeWidth={1.9} />
            </button>
          </div>
        )}
      </TrackCell>
      {showAfterLine && <DropIndicator />}
    </motion.div>
  );
}

function DropIndicator() {
  return (
    <div className="pointer-events-none relative z-20 h-0">
      <div className="absolute -top-px left-2 right-2 h-0.5 rounded-full bg-primary" />
    </div>
  );
}

function NowPlayingIndicator() {
  return (
    <span className="flex size-5 items-center justify-center gap-[1.5px]">
      {[6, 12, 8, 15].map((height, index) => (
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
