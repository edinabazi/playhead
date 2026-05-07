import { useIcons } from "@/lib/icon-context";
import { TrackCell } from "@/features/tracks/TrackCell";
import type { LibraryAlbum, LibraryArtist } from "./library-model";
import { ArtistArtwork } from "./ArtistArtwork";

export function LibraryBrowser({
  emptyLabel,
  artists,
  albums,
  onSelectArtist,
  onSelectAlbum,
}: {
  emptyLabel: string;
  artists?: LibraryArtist[];
  albums?: LibraryAlbum[];
  onSelectArtist?: (artist: LibraryArtist) => void;
  onSelectAlbum?: (album: LibraryAlbum) => void;
}) {
  const icons = useIcons();
  const MusicIcon = icons.music;
  const ChevronRightIcon = icons["chevron-right"];
  const rows = artists || albums || [];

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
                <TrackCell key={artist.id} onClick={() => onSelectArtist?.(artist)}>
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
                  <TrackCell key={album.id} onClick={() => onSelectAlbum?.(album)}>
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
