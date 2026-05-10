import { useIcons } from "@/lib/icon-context";
import { TrackCell } from "@/features/tracks/TrackCell";
import type { LibraryAlbum, LibraryArtist } from "./library-model";
import { ArtistArtwork } from "./ArtistArtwork";
import { setDraggedTrackIds } from "@/features/tracks/track-drag";

export function LibraryBrowser({
  emptyLabel,
  artists,
  albums,
  selectedItemIds = [],
  onActivateArtist,
  onActivateAlbum,
  onSelectArtist,
  onSelectAlbum,
}: {
  emptyLabel: string;
  artists?: LibraryArtist[];
  albums?: LibraryAlbum[];
  selectedItemIds?: string[];
  onActivateArtist?: (artist: LibraryArtist) => void;
  onActivateAlbum?: (album: LibraryAlbum) => void;
  onSelectArtist?: (artist: LibraryArtist, event?: React.MouseEvent<HTMLDivElement>) => void;
  onSelectAlbum?: (album: LibraryAlbum, event?: React.MouseEvent<HTMLDivElement>) => void;
}) {
  const icons = useIcons();
  const MusicIcon = icons.music;
  const ChevronRightIcon = icons["chevron-right"];
  const rows = artists || albums || [];
  const selectedItemIdSet = new Set(selectedItemIds);

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
    </section>
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
