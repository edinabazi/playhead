import { Dropdown } from "@/components/ui/dropdown";
import { MenuItem } from "@/components/ui/menu-item";
import { useIcons } from "@/lib/icon-context";
import { clampMenuPoint, shouldOpenSubmenuLeft, type MenuAnchorPoint } from "@/lib/menu-position";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type {
  LibraryFolder,
  LibraryPlaylist,
  LibraryTag,
  PlaylistExportFormat,
  SoundCloudCollection,
} from "../../../../shared/library";

export type SidebarContextMenuState =
  | { type: "folder"; item: LibraryFolder; point: MenuAnchorPoint }
  | { type: "playlist"; item: LibraryPlaylist; point: MenuAnchorPoint }
  | { type: "tag"; item: LibraryTag; point: MenuAnchorPoint }
  | { type: "soundcloud-playlist"; item: SoundCloudCollection; point: MenuAnchorPoint }
  | null;

export function SidebarContextMenu({
  state,
  onOpenChange,
  onRemoveFolder,
  onExportPlaylist,
  onRenamePlaylist,
  onDeletePlaylist,
  onRenameTag,
  onDeleteTag,
  onRenameSoundCloudPlaylist,
  onDeleteSoundCloudPlaylist,
}: {
  state: SidebarContextMenuState;
  onOpenChange: (state: SidebarContextMenuState) => void;
  onRemoveFolder: (folder: LibraryFolder) => void;
  onExportPlaylist: (playlist: LibraryPlaylist, format: PlaylistExportFormat) => void;
  onRenamePlaylist: (playlist: LibraryPlaylist) => void;
  onDeletePlaylist: (playlist: LibraryPlaylist) => void;
  onRenameTag: (tag: LibraryTag) => void;
  onDeleteTag: (tag: LibraryTag) => void;
  onRenameSoundCloudPlaylist: (playlist: SoundCloudCollection) => void;
  onDeleteSoundCloudPlaylist: (playlist: SoundCloudCollection) => void;
}) {
  const icons = useIcons();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const exportTriggerRef = useRef<HTMLDivElement | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportSide, setExportSide] = useState<"left" | "right">("right");
  const ChevronRightIcon = icons["chevron-right"];

  useEffect(() => {
    if (!state) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) onOpenChange(null);
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [onOpenChange, state]);

  useEffect(() => {
    setExportOpen(false);
  }, [state]);

  if (!state) return null;

  const point = clampMenuPoint(state.point, 248, state.type === "folder" ? 56 : 136);

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
        ) : state.type === "playlist" ? (
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
            <div
              className="relative"
              ref={exportTriggerRef}
              onMouseEnter={() => {
                setExportSide(shouldOpenSubmenuLeft(exportTriggerRef.current) ? "left" : "right");
                setExportOpen(true);
              }}
              onMouseLeave={() => setExportOpen(false)}
            >
              <MenuItem
                icon={icons.download}
                label="Export Playlist"
                index={1}
                className="pr-8"
                onSelect={() => setExportOpen((value) => !value)}
              />
              <ChevronRightIcon
                size={14}
                strokeWidth={1.8}
                className="pointer-events-none absolute right-2 top-1/2 z-20 -translate-y-1/2 text-muted-foreground"
              />
              {exportOpen && (
                <div
                  className={`absolute top-[-5px] z-10 ${
                    exportSide === "left"
                      ? "right-[calc(100%-2px)] pr-2"
                      : "left-[calc(100%-2px)] pl-2"
                  }`}
                  onMouseMove={(event) => event.stopPropagation()}
                  onMouseEnter={() => setExportOpen(true)}
                >
                  <Dropdown className="w-48 bg-[rgba(10,10,10,0.96)]">
                    <MenuItem
                      icon={icons["list-music"]}
                      label="M3U"
                      index={0}
                      onSelect={() => {
                        onExportPlaylist(state.item, "m3u");
                        setExportOpen(false);
                        onOpenChange(null);
                      }}
                    />
                    <MenuItem
                      icon={icons["list-music"]}
                      label="M3U8"
                      index={1}
                      onSelect={() => {
                        onExportPlaylist(state.item, "m3u8");
                        setExportOpen(false);
                        onOpenChange(null);
                      }}
                    />
                    <MenuItem
                      icon={icons["list-music"]}
                      label="Playhead JSON"
                      index={2}
                      onSelect={() => {
                        onExportPlaylist(state.item, "playhead");
                        setExportOpen(false);
                        onOpenChange(null);
                      }}
                    />
                    <MenuItem
                      icon={icons["list-music"]}
                      label="rekordbox XML"
                      index={3}
                      onSelect={() => {
                        onExportPlaylist(state.item, "rekordbox");
                        setExportOpen(false);
                        onOpenChange(null);
                      }}
                    />
                    <MenuItem
                      icon={icons["list-music"]}
                      label="Traktor NML"
                      index={4}
                      onSelect={() => {
                        onExportPlaylist(state.item, "traktor");
                        setExportOpen(false);
                        onOpenChange(null);
                      }}
                    />
                  </Dropdown>
                </div>
              )}
            </div>
            <MenuItem
              icon={icons["trash-2"]}
              label="Delete Playlist"
              index={2}
              onSelect={() => {
                onDeletePlaylist(state.item);
                onOpenChange(null);
              }}
            />
          </>
        ) : state.type === "soundcloud-playlist" ? (
          <>
            <MenuItem
              icon={icons.pencil}
              label="Rename Playlist"
              index={0}
              onSelect={() => {
                onRenameSoundCloudPlaylist(state.item);
                onOpenChange(null);
              }}
            />
            <MenuItem
              icon={icons["trash-2"]}
              label="Delete from SoundCloud"
              index={1}
              onSelect={() => {
                onDeleteSoundCloudPlaylist(state.item);
                onOpenChange(null);
              }}
            />
          </>
        ) : (
          <>
            <MenuItem
              icon={icons.pencil}
              label="Rename Tag"
              index={0}
              onSelect={() => {
                onRenameTag(state.item);
                onOpenChange(null);
              }}
            />
            <MenuItem
              icon={icons["trash-2"]}
              label="Delete Tag"
              index={1}
              onSelect={() => {
                onDeleteTag(state.item);
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
