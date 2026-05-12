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
import type { LibraryPlaylist, LibraryTag, LibraryTrack } from "../../../../shared/library";

export function TrackRowMenu({
  track,
  selectedTracks,
  playlists,
  tags,
  selectedPlaylist,
  selectedTag,
  menuIcon: MenuIcon,
  open,
  anchorPoint,
  onOpenChange,
  onAddToPlaylist,
  onAddTracksToPlaylist,
  onCreatePlaylist,
  onAddTracksToTag,
  onCreateTag,
  onRemoveFromPlaylist,
  onRemoveFromTag,
  onShowInFolder,
  onShowMetadata,
  onViewArtist,
  onViewAlbum,
  showTrigger = true,
}: {
  track: LibraryTrack;
  selectedTracks?: LibraryTrack[];
  playlists: LibraryPlaylist[];
  tags: LibraryTag[];
  selectedPlaylist: LibraryPlaylist | null;
  selectedTag: LibraryTag | null;
  menuIcon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  open: boolean;
  anchorPoint: MenuAnchorPoint | null;
  onOpenChange: (open: boolean, point: MenuAnchorPoint | null) => void;
  onAddToPlaylist: (track: LibraryTrack, playlist: LibraryPlaylist) => void;
  onAddTracksToPlaylist?: (tracks: LibraryTrack[], playlist: LibraryPlaylist) => void;
  onCreatePlaylist: (tracks: LibraryTrack[]) => void;
  onAddTracksToTag: (tracks: LibraryTrack[], tag: LibraryTag) => void;
  onCreateTag: (tracks: LibraryTrack[]) => void;
  onRemoveFromPlaylist: (trackIds: string[]) => void;
  onRemoveFromTag: (trackIds: string[]) => void;
  onShowInFolder: (track: LibraryTrack) => void;
  onShowMetadata: (track: LibraryTrack) => void;
  onViewArtist?: (track: LibraryTrack) => void;
  onViewAlbum?: (track: LibraryTrack) => void;
  showTrigger?: boolean;
}) {
  const icons = useIcons();
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [playlistSide, setPlaylistSide] = useState<"left" | "right">("right");
  const [tagSide, setTagSide] = useState<"left" | "right">("right");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const playlistTriggerRef = useRef<HTMLDivElement | null>(null);
  const tagTriggerRef = useRef<HTMLDivElement | null>(null);
  const ListPlusIcon = icons["list-plus"];
  const TagIcon = icons.tag;
  const FinderIcon = icons["folder-search"];
  const InfoIcon = icons.info;
  const UserIcon = icons.user;
  const AlbumIcon = icons["square-library"];
  const ChevronRightIcon = icons["chevron-right"];
  const fileManagerName = getNativeFileManagerName();
  const tracksForAction =
    selectedTracks && selectedTracks.length > 1 ? selectedTracks : [track];
  const isMultiTrackMenu = tracksForAction.length > 1;

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        onOpenChange(false, null);
        setPlaylistOpen(false);
        setTagOpen(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [onOpenChange, open]);

  const menuPoint = anchorPoint || getMenuPointFromElement(buttonRef.current);
  const clampedMenuPoint = menuPoint ? clampMenuPoint(menuPoint) : null;

  return (
    <div className="relative" ref={containerRef} onClick={(event) => event.stopPropagation()}>
      {showTrigger && (
        <button
          ref={buttonRef}
          className="no-drag grid size-[18px] place-items-center text-muted-foreground transition hover:text-foreground"
          title="Track actions"
          onClick={() => onOpenChange(!open, getMenuPointFromElement(buttonRef.current))}
        >
          <MenuIcon size={18} strokeWidth={1.7} />
        </button>
      )}

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
                  className={`absolute top-[-5px] z-10 ${
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
                          checked={tracksForAction.every((item) => playlist.trackIds.includes(item.id))}
                          onSelect={() => {
                            if (isMultiTrackMenu && onAddTracksToPlaylist) {
                              onAddTracksToPlaylist(tracksForAction, playlist);
                            } else {
                              onAddToPlaylist(track, playlist);
                            }
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
                        onCreatePlaylist(tracksForAction);
                        onOpenChange(false, null);
                        setPlaylistOpen(false);
                      }}
                    />
                  </Dropdown>
                </div>
              )}
            </div>
            <div
              className="relative"
              ref={tagTriggerRef}
              onMouseEnter={() => {
                setTagSide(shouldOpenSubmenuLeft(tagTriggerRef.current) ? "left" : "right");
                setTagOpen(true);
              }}
              onMouseLeave={() => setTagOpen(false)}
            >
              <MenuItem
                icon={TagIcon}
                label="Add Tag"
                index={1}
                className="pr-8"
                onSelect={() => setTagOpen((value) => !value)}
              />
              <ChevronRightIcon
                size={14}
                strokeWidth={1.8}
                className="pointer-events-none absolute right-2 top-1/2 z-20 -translate-y-1/2 text-muted-foreground"
              />
              {tagOpen && (
                <div
                  className={`absolute top-[-5px] z-10 ${
                    tagSide === "left"
                      ? "right-[calc(100%-2px)] pr-2"
                      : "left-[calc(100%-2px)] pl-2"
                  }`}
                  onMouseMove={(event) => event.stopPropagation()}
                  onMouseEnter={() => setTagOpen(true)}
                >
                  <Dropdown className="w-52 bg-[rgba(10,10,10,0.96)]">
                    {tags.length > 0 &&
                      tags.map((tag, index) => (
                        <MenuItem
                          key={tag.id}
                          icon={icons.tag}
                          label={tag.name}
                          index={index}
                          checked={tracksForAction.every((item) => tag.trackIds.includes(item.id))}
                          onSelect={() => {
                            onAddTracksToTag(tracksForAction, tag);
                            onOpenChange(false, null);
                            setTagOpen(false);
                          }}
                        />
                      ))}
                    <MenuItem
                      icon={icons.plus}
                      label="Create Tag"
                      index={tags.length}
                      onSelect={() => {
                        onCreateTag(tracksForAction);
                        onOpenChange(false, null);
                        setTagOpen(false);
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
                index={2}
                onSelect={() => {
                  onRemoveFromPlaylist(tracksForAction.map((item) => item.id));
                  onOpenChange(false, null);
                }}
              />
            )}
            {selectedTag && (
              <MenuItem
                icon={icons.x}
                label="Remove from Tag"
                index={selectedPlaylist ? 3 : 2}
                onSelect={() => {
                  onRemoveFromTag(tracksForAction.map((item) => item.id));
                  onOpenChange(false, null);
                }}
              />
            )}
            {!isMultiTrackMenu && (
              <>
                <DropdownSeparator />
                {onViewArtist && (
                  <MenuItem
                    icon={UserIcon}
                    label="View Artist"
                    index={4}
                    onSelect={() => {
                      onViewArtist(track);
                      onOpenChange(false, null);
                    }}
                  />
                )}
                {onViewAlbum && (
                  <MenuItem
                    icon={AlbumIcon}
                    label="View Album"
                    index={5}
                    onSelect={() => {
                      onViewAlbum(track);
                      onOpenChange(false, null);
                    }}
                  />
                )}
                {(onViewArtist || onViewAlbum) && <DropdownSeparator />}
                <MenuItem
                  icon={FinderIcon}
                  label={`Show in ${fileManagerName}`}
                  index={6}
                  onSelect={() => {
                    onShowInFolder(track);
                    onOpenChange(false, null);
                  }}
                />
                <MenuItem
                  icon={InfoIcon}
                  label="Metadata"
                  index={7}
                  onSelect={() => {
                    onShowMetadata(track);
                    onOpenChange(false, null);
                  }}
                />
              </>
            )}
          </Dropdown>
        </div>
      )}
    </div>
  );
}
