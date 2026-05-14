import { useState } from "react";
import { useIcons } from "@/lib/icon-context";
import type { LibraryTrack, PlaybackQueueItem } from "../../../../shared/library";
import { TrackArtwork } from "@/features/tracks/TrackArtwork";
import { TrackCell } from "@/features/tracks/TrackCell";
import {
  getDraggedQueueItemIds,
  getDraggedTrackIds,
  setDraggedQueueItemIds,
} from "@/features/tracks/track-drag";
import type { QueueDropEdge } from "./queue-model";

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
  const validItems = items.filter((item) => tracksById[item.trackId]);
  const activeIndex = validItems.findIndex((item) => item.id === activeItemId);
  const activeItem = activeIndex >= 0 ? validItems[activeIndex] : validItems[0] || null;
  const upcomingItems = activeIndex >= 0 ? validItems.slice(activeIndex + 1) : validItems.slice(1);
  const activeTrack = activeItem ? tracksById[activeItem.trackId] : null;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col no-drag">
      <div
        className="thin-scrollbar -mx-2 min-h-0 flex-1 overflow-y-auto px-2"
        onDragOver={(event) => {
          if (validItems.length > 0) return;
          if (getDraggedTrackIds(event.dataTransfer).length === 0) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(event) => {
          if (validItems.length > 0) return;
          const trackIds = getDraggedTrackIds(event.dataTransfer);
          if (trackIds.length === 0) return;
          event.preventDefault();
          onAddTracks(trackIds, null, "after");
        }}
      >
        {validItems.length === 0 || !activeItem || !activeTrack ? (
          <div className="flex h-full min-h-[180px] items-center justify-center rounded-[22px] border border-dashed border-white/12 bg-white/[0.025] px-5 text-center text-[13px] font-medium leading-normal text-muted-foreground">
            Drop tracks here to build a queue.
          </div>
        ) : (
          <div className="flex flex-col gap-4 pb-4">
            <div className="flex flex-col gap-0.5">
              <SectionLabel>Now Playing</SectionLabel>
              <QueueRow
                item={activeItem}
                selected={false}
                removable={false}
                track={activeTrack}
                fallbackIcon={MusicIcon}
                removeIcon={XIcon}
                dragging={draggedItemIds.includes(activeItem.id)}
                showBeforeLine={
                  dropIndicator?.itemId === activeItem.id && dropIndicator.edge === "before"
                }
                showAfterLine={
                  dropIndicator?.itemId === activeItem.id && dropIndicator.edge === "after"
                }
                onPlayItem={onPlayItem}
                onRemoveItem={onRemoveItem}
                onReorderItems={onReorderItems}
                onAddTracks={onAddTracks}
                setDraggedItemIds={setDraggedItemIds}
                setDropIndicator={setDropIndicator}
              />
            </div>

            <div className="flex flex-col gap-0.5">
              <SectionLabel>Up Next</SectionLabel>
              {upcomingItems.length === 0 ? (
                <div className="rounded-[18px] border border-dashed border-white/10 bg-white/[0.025] px-4 py-5 text-center text-[13px] font-medium text-muted-foreground">
                  No upcoming tracks.
                </div>
              ) : (
                upcomingItems.map((item) => {
                  const track = tracksById[item.trackId];
                  const showBeforeLine =
                    dropIndicator?.itemId === item.id && dropIndicator.edge === "before";
                  const showAfterLine =
                    dropIndicator?.itemId === item.id && dropIndicator.edge === "after";

                  return (
                    <QueueRow
                      key={item.id}
                      item={item}
                      selected={false}
                      removable
                      track={track}
                      fallbackIcon={MusicIcon}
                      removeIcon={XIcon}
                      dragging={draggedItemIds.includes(item.id)}
                      showBeforeLine={showBeforeLine}
                      showAfterLine={showAfterLine}
                      onPlayItem={onPlayItem}
                      onRemoveItem={onRemoveItem}
                      onReorderItems={onReorderItems}
                      onAddTracks={onAddTracks}
                      setDraggedItemIds={setDraggedItemIds}
                      setDropIndicator={setDropIndicator}
                    />
                  );
                })
              )}
            </div>
          </div>
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
    <div className="relative -mx-2 w-[calc(100%+16px)]">
      {showBeforeLine && <DropIndicator />}
      <TrackCell
        draggable
        trackId={track.id}
        selected={selected}
        dragging={dragging}
        onDoubleClick={() => onPlayItem(item)}
        onDragStart={(event) => {
          setDraggedItemIds([item.id]);
          event.dataTransfer.effectAllowed = "copyMove";
          setDraggedQueueItemIds(event.dataTransfer, [item.id], item.id);
        }}
        onDragEnd={() => {
          setDraggedItemIds([]);
          setDropIndicator(null);
        }}
        onDragOver={(event) => {
          const queueItemIds = getDraggedQueueItemIds(event.dataTransfer);
          const trackIds = getDraggedTrackIds(event.dataTransfer);
          if (queueItemIds.length === 0 && trackIds.length === 0) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = queueItemIds.length > 0 ? "move" : "copy";

          const rect = event.currentTarget.getBoundingClientRect();
          const edge = event.clientY < rect.top + rect.height / 2 ? "before" : "after";
          setDropIndicator({ itemId: item.id, edge });
        }}
        onDragLeave={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
          setDropIndicator((current) => (current?.itemId === item.id ? null : current));
        }}
        onDrop={(event) => {
          event.preventDefault();
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
        }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3 pr-3">
          <TrackArtwork track={track} fallbackIcon={fallbackIcon} />
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold leading-[1.18]">{track.title}</p>
            <p className="mt-0.5 truncate text-[13px] font-medium leading-[1.25] text-muted-foreground">
              {track.artist}
            </p>
          </div>
        </div>
        {removable && (
          <div className="flex shrink-0 items-center gap-3 text-[13px] font-medium tabular-nums text-muted-foreground">
            <button
              type="button"
              className="grid size-[18px] place-items-center text-muted-foreground opacity-0 transition hover:text-foreground group-hover:opacity-100"
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
    </div>
  );
}

function DropIndicator() {
  return (
    <div className="pointer-events-none relative z-20 h-0">
      <div className="absolute -top-px left-2 right-2 h-0.5 rounded-full bg-primary" />
    </div>
  );
}
