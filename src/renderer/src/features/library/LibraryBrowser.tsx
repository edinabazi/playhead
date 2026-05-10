import { useEffect, useRef, useState } from "react";
import { Dropdown } from "@/components/ui/dropdown";
import { MenuItem } from "@/components/ui/menu-item";
import { useIcons } from "@/lib/icon-context";
import {
  clampMenuPoint,
  shouldOpenSubmenuLeft,
  type MenuAnchorPoint,
} from "@/lib/menu-position";
import { TrackCell } from "@/features/tracks/TrackCell";
import type { LibraryAlbum, LibraryArtist } from "./library-model";
import { ArtistArtwork } from "./ArtistArtwork";
import { setDraggedTrackIds } from "@/features/tracks/track-drag";
import type { LibraryPlaylist } from "../../../../shared/library";

export function LibraryBrowser({
  emptyLabel,
  artists,
  albums,
  selectedItemIds = [],
  playlists,
  onActivateArtist,
  onActivateAlbum,
  onSelectArtist,
  onSelectAlbum,
  onAddTrackIdsToPlaylist,
}: {
  emptyLabel: string;
  artists?: LibraryArtist[];
  albums?: LibraryAlbum[];
  selectedItemIds?: string[];
  playlists: LibraryPlaylist[];
  onActivateArtist?: (artist: LibraryArtist) => void;
  onActivateAlbum?: (album: LibraryAlbum) => void;
  onSelectArtist?: (artist: LibraryArtist, event?: React.MouseEvent<HTMLDivElement>) => void;
  onSelectAlbum?: (album: LibraryAlbum, event?: React.MouseEvent<HTMLDivElement>) => void;
  onAddTrackIdsToPlaylist: (trackIds: string[], playlist: LibraryPlaylist) => void;
}) {
  const icons = useIcons();
  const MusicIcon = icons.music;
  const ChevronRightIcon = icons["chevron-right"];
  const rows = artists || albums || [];
  const selectedItemIdSet = new Set(selectedItemIds);
  const [contextMenu, setContextMenu] = useState<{
    point: MenuAnchorPoint;
    trackIds: string[];
  } | null>(null);

  const startCollectionDrag = (
    item: LibraryArtist | LibraryAlbum,
    items: Array<LibraryArtist | LibraryAlbum>,
    event: React.DragEvent<HTMLDivElement>,
  ) => {
    const draggedItems = selectedItemIdSet.has(item.id)
      ? items.filter((row) => selectedItemIdSet.has(row.id))
      : [item];
    const trackIds = Array.from(new Set(draggedItems.flatMap((row) => row.trackIds)));
    if (trackIds.length === 0) return;

    event.dataTransfer.effectAllowed = "move";
    setDraggedTrackIds(event.dataTransfer, trackIds, trackIds[0]);
    const dragImage = createCollectionDragImage(draggedItems, trackIds.length);
    document.body.appendChild(dragImage);
    event.dataTransfer.setDragImage(dragImage, 26, 24);
    window.setTimeout(() => dragImage.remove(), 0);
  };

  const openContextMenu = (
    item: LibraryArtist | LibraryAlbum,
    items: Array<LibraryArtist | LibraryAlbum>,
    event: React.MouseEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();
    const actionItems = selectedItemIdSet.has(item.id)
      ? items.filter((row) => selectedItemIdSet.has(row.id))
      : [item];
    const trackIds = Array.from(new Set(actionItems.flatMap((row) => row.trackIds)));
    if (trackIds.length === 0) return;

    setContextMenu({
      point: { x: event.clientX, y: event.clientY, align: "left" },
      trackIds,
    });
  };

  return (
    <section className="-mb-4 flex min-h-0 flex-1 flex-col gap-[14px]">
      <div className="relative min-h-0 flex-1">
        <div className="thin-scrollbar no-drag h-full min-h-0 overflow-y-auto pr-2">
          {rows.length === 0 ? (
            <div className="flex h-full min-h-[180px] items-center justify-center rounded-[28px] border border-white/10 bg-white/[0.025] text-[14px] text-muted-foreground">
              {emptyLabel}
            </div>
          ) : (
            <div className="flex flex-col gap-0.5 pb-8">
              {artists?.map((artist) => (
                <TrackCell
                  key={artist.id}
                  draggable
                  selected={selectedItemIdSet.has(artist.id)}
                  onClick={(event) => onSelectArtist?.(artist, event)}
                  onDoubleClick={() => onActivateArtist?.(artist)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") onActivateArtist?.(artist);
                  }}
                  onContextMenu={(event) => {
                    if (!selectedItemIdSet.has(artist.id)) onSelectArtist?.(artist);
                    openContextMenu(artist, artists, event);
                  }}
                  onDragStart={(event) => startCollectionDrag(artist, artists, event)}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3 pr-6">
                    <ArtistArtwork artist={artist} fallbackIcon={icons.user} />
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-semibold leading-[1.18] text-foreground">
                        {artist.name}
                      </span>
                      <span className="mt-1 block truncate text-[13px] font-medium leading-[1.25] text-muted-foreground">
                        Artist
                      </span>
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-0 text-[13px] font-medium tabular-nums text-muted-foreground">
                    <span>
                      {artist.trackIds.length} {artist.trackIds.length === 1 ? "track" : "tracks"}
                    </span>
                    <span className="grid size-8 place-items-center rounded-full text-muted-foreground transition group-hover:text-foreground">
                      <ChevronRightIcon size={17} strokeWidth={1.8} />
                    </span>
                  </div>
                </TrackCell>
              ))}
              {albums?.map((album) => {
                const artworkSrc = album.artwork?.dataUrl || album.artwork?.src || null;
                const subtitle = [album.artist, album.year].filter(Boolean).join(" · ");

                return (
                  <TrackCell
                    key={album.id}
                    draggable
                    selected={selectedItemIdSet.has(album.id)}
                    onClick={(event) => onSelectAlbum?.(album, event)}
                    onDoubleClick={() => onActivateAlbum?.(album)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") onActivateAlbum?.(album);
                    }}
                    onContextMenu={(event) => {
                      if (!selectedItemIdSet.has(album.id)) onSelectAlbum?.(album);
                      openContextMenu(album, albums, event);
                    }}
                    onDragStart={(event) => startCollectionDrag(album, albums, event)}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3 pr-6">
                      <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-[12px] bg-white/10 text-muted-foreground">
                        {artworkSrc ? (
                          <img
                            className="size-full object-contain"
                            src={artworkSrc}
                            alt=""
                            draggable={false}
                          />
                        ) : (
                          <MusicIcon size={18} strokeWidth={1.8} />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-semibold leading-[1.18] text-foreground">
                          {album.title}
                        </span>
                        <span className="mt-1 block truncate text-[13px] font-medium leading-[1.25] text-muted-foreground">
                          {subtitle}
                        </span>
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-4 text-[13px] font-medium tabular-nums text-muted-foreground">
                      <span>
                        {album.trackIds.length} {album.trackIds.length === 1 ? "track" : "tracks"}
                      </span>
                      <span className="grid size-8 place-items-center rounded-full text-muted-foreground transition group-hover:text-foreground">
                        <ChevronRightIcon size={17} strokeWidth={1.8} />
                      </span>
                    </div>
                  </TrackCell>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {contextMenu && (
        <LibraryCollectionContextMenu
          point={contextMenu.point}
          trackIds={contextMenu.trackIds}
          playlists={playlists}
          onAddTrackIdsToPlaylist={onAddTrackIdsToPlaylist}
          onClose={() => setContextMenu(null)}
        />
      )}
    </section>
  );
}

function LibraryCollectionContextMenu({
  point,
  trackIds,
  playlists,
  onAddTrackIdsToPlaylist,
  onClose,
}: {
  point: MenuAnchorPoint;
  trackIds: string[];
  playlists: LibraryPlaylist[];
  onAddTrackIdsToPlaylist: (trackIds: string[], playlist: LibraryPlaylist) => void;
  onClose: () => void;
}) {
  const icons = useIcons();
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [playlistSide, setPlaylistSide] = useState<"left" | "right">("right");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playlistTriggerRef = useRef<HTMLDivElement | null>(null);
  const ChevronRightIcon = icons["chevron-right"];
  const clampedPoint = clampMenuPoint(point);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) onClose();
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [onClose]);

  return (
    <div
      ref={containerRef}
      className="fixed z-50"
      style={{
        left: clampedPoint.x,
        top: clampedPoint.y,
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <Dropdown className="w-56 bg-[rgba(10,10,10,0.96)]">
        <div
          className="relative"
          ref={playlistTriggerRef}
          onMouseEnter={() => {
            setPlaylistSide(shouldOpenSubmenuLeft(playlistTriggerRef.current) ? "left" : "right");
            setPlaylistOpen(true);
          }}
          onMouseLeave={() => setPlaylistOpen(false)}
        >
          <MenuItem
            icon={icons["list-plus"]}
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
                {playlists.length > 0 ? (
                  playlists.map((playlist, index) => (
                    <MenuItem
                      key={playlist.id}
                      icon={icons["list-music"]}
                      label={playlist.name}
                      index={index}
                      checked={trackIds.every((trackId) => playlist.trackIds.includes(trackId))}
                      onSelect={() => {
                        onAddTrackIdsToPlaylist(trackIds, playlist);
                        setPlaylistOpen(false);
                        onClose();
                      }}
                    />
                  ))
                ) : (
                  <MenuItem
                    icon={icons["list-music"]}
                    label="No Playlists"
                    index={0}
                    onSelect={() => undefined}
                  />
                )}
              </Dropdown>
            </div>
          )}
        </div>
      </Dropdown>
    </div>
  );
}

function createCollectionDragImage(items: Array<LibraryArtist | LibraryAlbum>, trackCount: number) {
  const preview = document.createElement("div");
  const visibleItems = items.slice(0, 3);

  Object.assign(preview.style, {
    position: "fixed",
    top: "-1000px",
    left: "-1000px",
    width: "244px",
    height: "72px",
    pointerEvents: "none",
    zIndex: "9999",
  });

  visibleItems
    .slice()
    .reverse()
    .forEach((item, reversedIndex) => {
      const index = visibleItems.length - 1 - reversedIndex;
      const card = document.createElement("div");
      const title = document.createElement("div");
      const detail = document.createElement("div");
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

      Object.assign(detail.style, {
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

      title.textContent = "title" in item ? item.title : item.name;
      detail.textContent = `${item.trackIds.length} ${item.trackIds.length === 1 ? "track" : "tracks"}`;
      badge.textContent = `${trackCount}`;
      card.append(title, detail, badge);
      preview.appendChild(card);
    });

  return preview;
}
