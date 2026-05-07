import { useEffect, useRef, useState } from "react";
import { Dropdown, DropdownSeparator } from "@/components/ui/dropdown";
import { MenuItem } from "@/components/ui/menu-item";
import { useIcons } from "@/lib/icon-context";
import {
  clampMenuPoint,
  getMenuPointFromElement,
  getNativeFileManagerName,
  shouldOpenSubmenuLeft,
  type MenuAnchorPoint,
} from "@/lib/menu-position";
import type { LibraryPlaylist, LibraryTrack } from "../../../../shared/library";

export function TrackRowMenu({
  track,
  playlists,
  selectedPlaylist,
  menuIcon: MenuIcon,
  open,
  anchorPoint,
  onOpenChange,
  onAddToPlaylist,
  onCreatePlaylist,
  onRemoveFromPlaylist,
  onShowInFolder,
  onShowMetadata,
}: {
  track: LibraryTrack;
  playlists: LibraryPlaylist[];
  selectedPlaylist: LibraryPlaylist | null;
  menuIcon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  open: boolean;
  anchorPoint: MenuAnchorPoint | null;
  onOpenChange: (open: boolean, point: MenuAnchorPoint | null) => void;
  onAddToPlaylist: (track: LibraryTrack, playlist: LibraryPlaylist) => void;
  onCreatePlaylist: (track: LibraryTrack) => void;
  onRemoveFromPlaylist: (trackId: string) => void;
  onShowInFolder: (track: LibraryTrack) => void;
  onShowMetadata: (track: LibraryTrack) => void;
}) {
  const icons = useIcons();
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [playlistSide, setPlaylistSide] = useState<"left" | "right">("right");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const playlistTriggerRef = useRef<HTMLDivElement | null>(null);
  const ListPlusIcon = icons["list-plus"];
  const FinderIcon = icons["folder-search"];
  const InfoIcon = icons.info;
  const ChevronRightIcon = icons["chevron-right"];
  const fileManagerName = getNativeFileManagerName();

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        onOpenChange(false, null);
        setPlaylistOpen(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [onOpenChange, open]);

  const menuPoint = anchorPoint || getMenuPointFromElement(buttonRef.current);
  const clampedMenuPoint = menuPoint ? clampMenuPoint(menuPoint) : null;

  return (
    <div className="relative" ref={containerRef} onClick={(event) => event.stopPropagation()}>
      <button
        ref={buttonRef}
        className="no-drag grid size-[18px] place-items-center text-muted-foreground transition hover:text-foreground"
        title="Track actions"
        onClick={() => onOpenChange(!open, getMenuPointFromElement(buttonRef.current))}
      >
        <MenuIcon size={18} strokeWidth={1.7} />
      </button>

      {open && (
        <div
          className="fixed z-50"
          style={
            clampedMenuPoint
              ? {
                  left: clampedMenuPoint.x,
                  top: clampedMenuPoint.y,
                }
              : undefined
          }
        >
          <Dropdown className="w-56 bg-[rgba(10,10,10,0.96)]">
            <div
              className="relative"
              ref={playlistTriggerRef}
              onMouseEnter={() => {
                setPlaylistSide(
                  shouldOpenSubmenuLeft(playlistTriggerRef.current) ? "left" : "right",
                );
                setPlaylistOpen(true);
              }}
              onMouseLeave={() => setPlaylistOpen(false)}
            >
              <MenuItem
                icon={ListPlusIcon}
                label="Add to Playlist"
                index={0}
                className="pr-8"
                onSelect={() => setPlaylistOpen((value) => !value)}
              />
              <ChevronRightIcon
                size={14}
                strokeWidth={1.8}
                className="pointer-events-none absolute right-2 top-1/2 z-20 -translate-y-1/2 text-muted-foreground"
              />
              {playlistOpen && (
                <div
                  className={`absolute top-0 z-10 ${
                    playlistSide === "left"
                      ? "right-[calc(100%-2px)] pr-2"
                      : "left-[calc(100%-2px)] pl-2"
                  }`}
                  onMouseMove={(event) => event.stopPropagation()}
                  onMouseEnter={() => setPlaylistOpen(true)}
                >
                  <Dropdown className="w-52 bg-[rgba(10,10,10,0.96)]">
                    {playlists.length > 0 &&
                      playlists.map((playlist, index) => (
                        <MenuItem
                          key={playlist.id}
                          icon={icons["list-music"]}
                          label={playlist.name}
                          index={index}
                          checked={playlist.trackIds.includes(track.id)}
                          onSelect={() => {
                            onAddToPlaylist(track, playlist);
                            onOpenChange(false, null);
                            setPlaylistOpen(false);
                          }}
                        />
                      ))}
                    <MenuItem
                      icon={icons.plus}
                      label="Create Playlist"
                      index={playlists.length}
                      onSelect={() => {
                        onCreatePlaylist(track);
                        onOpenChange(false, null);
                        setPlaylistOpen(false);
                      }}
                    />
                  </Dropdown>
                </div>
              )}
            </div>
            {selectedPlaylist && (
              <MenuItem
                icon={icons.x}
                label="Remove from Playlist"
                index={1}
                onSelect={() => {
                  onRemoveFromPlaylist(track.id);
                  onOpenChange(false, null);
                }}
              />
            )}
            <DropdownSeparator />
            <MenuItem
              icon={FinderIcon}
              label={`Show in ${fileManagerName}`}
              index={2}
              onSelect={() => {
                onShowInFolder(track);
                onOpenChange(false, null);
              }}
            />
            <MenuItem
              icon={InfoIcon}
              label="Metadata"
              index={3}
              onSelect={() => {
                onShowMetadata(track);
                onOpenChange(false, null);
              }}
            />
          </Dropdown>
        </div>
      )}
    </div>
  );
}
