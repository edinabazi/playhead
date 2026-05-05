import { Dropdown } from "@/components/ui/dropdown";
import { MenuItem } from "@/components/ui/menu-item";
import { useIcons } from "@/lib/icon-context";
import { clampMenuPoint, type MenuAnchorPoint } from "@/lib/menu-position";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { LibraryFolder, LibraryPlaylist } from "../../../../shared/library";

export type SidebarContextMenuState =
  | { type: "folder"; item: LibraryFolder; point: MenuAnchorPoint }
  | { type: "playlist"; item: LibraryPlaylist; point: MenuAnchorPoint }
  | null;

export function SidebarContextMenu({
  state,
  onOpenChange,
  onRemoveFolder,
  onRenamePlaylist,
  onDeletePlaylist,
}: {
  state: SidebarContextMenuState;
  onOpenChange: (state: SidebarContextMenuState) => void;
  onRemoveFolder: (folder: LibraryFolder) => void;
  onRenamePlaylist: (playlist: LibraryPlaylist) => void;
  onDeletePlaylist: (playlist: LibraryPlaylist) => void;
}) {
  const icons = useIcons();
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!state) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) onOpenChange(null);
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [onOpenChange, state]);

  if (!state) return null;

  const point = clampMenuPoint(state.point, 248, state.type === "folder" ? 56 : 100);

  return createPortal(
    <div
      ref={containerRef}
      className="no-drag fixed z-[10000]"
      style={{ left: point.x, top: point.y }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <Dropdown className="w-[248px] bg-[rgba(10,10,10,0.96)]">
        {state.type === "folder" ? (
          <MenuItem
            icon={icons.x}
            label="Remove folder from Playhead"
            index={0}
            onSelect={() => {
              onRemoveFolder(state.item);
              onOpenChange(null);
            }}
          />
        ) : (
          <>
            <MenuItem
              icon={icons.pencil}
              label="Rename Playlist"
              index={0}
              onSelect={() => {
                onRenamePlaylist(state.item);
                onOpenChange(null);
              }}
            />
            <MenuItem
              icon={icons["trash-2"]}
              label="Delete Playlist"
              index={1}
              onSelect={() => {
                onDeletePlaylist(state.item);
                onOpenChange(null);
              }}
            />
          </>
        )}
      </Dropdown>
    </div>,
    document.body,
  );
}

