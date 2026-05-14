import type { AppUpdateState, LibraryTrack, PlaybackQueueItem } from "../../../../shared/library";
import { SidebarShell } from "@/features/sidebar/SidebarShell";
import { QueuePanel } from "./QueuePanel";
import type { QueueDropEdge } from "./queue-model";

export function QueueSidebar({
  items,
  tracksById,
  activeItemId,
  updateState,
  onToggleQueue,
  onOpenSearch,
  onOpenSettings,
  onInstallUpdate,
  onPlayItem,
  onReorderItems,
  onAddTracks,
  onRemoveItem,
}: {
  items: PlaybackQueueItem[];
  tracksById: Record<string, LibraryTrack>;
  activeItemId: string | null;
  updateState: AppUpdateState;
  onToggleQueue: () => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  onInstallUpdate: () => void;
  onPlayItem: (item: PlaybackQueueItem) => void;
  onReorderItems: (itemIds: string[], targetItemId: string, edge: QueueDropEdge) => void;
  onAddTracks: (trackIds: string[], targetItemId: string | null, edge: QueueDropEdge) => void;
  onRemoveItem: (item: PlaybackQueueItem) => void;
}) {
  return (
    <SidebarShell
      updateState={updateState}
      queueOpen
      onToggleQueue={onToggleQueue}
      onOpenSearch={onOpenSearch}
      onOpenSettings={onOpenSettings}
      onInstallUpdate={onInstallUpdate}
    >
      <div className="mt-[30px] flex min-h-0 flex-1 flex-col">
        <QueuePanel
          items={items}
          tracksById={tracksById}
          activeItemId={activeItemId}
          onPlayItem={onPlayItem}
          onReorderItems={onReorderItems}
          onAddTracks={onAddTracks}
          onRemoveItem={onRemoveItem}
        />
      </div>
    </SidebarShell>
  );
}
