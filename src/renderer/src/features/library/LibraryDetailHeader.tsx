import { useIcons } from "@/lib/icon-context";
import type { LibraryAlbum, LibraryArtist } from "./library-model";

export function LibraryDetailHeader({
  artist,
  album,
  onBack,
}: {
  artist?: LibraryArtist | null;
  album?: LibraryAlbum | null;
  onBack: () => void;
}) {
  const icons = useIcons();
  const ChevronLeftIcon = icons["chevron-left"];
  const UserIcon = icons.user;
  const MusicIcon = icons.music;

  if (!artist && !album) return null;

  const title = artist?.name || album?.title || "";
  const type = artist ? "Artist" : "Album";
  const trackCount = artist?.trackIds.length || album?.trackIds.length || 0;
  const albumArtworkSrc = album?.artwork?.dataUrl || album?.artwork?.src || null;
  const subtitle = artist
    ? `${trackCount} ${trackCount === 1 ? "track" : "tracks"}`
    : [album?.artist, `${trackCount} ${trackCount === 1 ? "track" : "tracks"}`]
        .filter(Boolean)
        .join(" · ");

  return (
    <div className="no-drag mr-2 flex shrink-0 items-center gap-3 rounded-[16px] border border-white/10 bg-white/[0.035] px-[10px] py-[7px]">
      <button
        type="button"
        style={{ marginRight: -8 }}
        className="grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
        aria-label={`Back to ${artist ? "artists" : "albums"}`}
        onClick={onBack}
      >
        <ChevronLeftIcon size={14} strokeWidth={1.8} />
      </button>
      <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-[14px] bg-white/10 text-muted-foreground">
        {albumArtworkSrc ? (
          <img className="size-full object-contain" src={albumArtworkSrc} alt="" draggable={false} />
        ) : artist ? (
          <UserIcon size={20} strokeWidth={1.8} />
        ) : (
          <MusicIcon size={20} strokeWidth={1.8} />
        )}
      </div>
      <div className="min-w-0">
        <div className="text-[12px] font-medium leading-4 text-muted-foreground">{type}</div>
        <h2 className="truncate text-[18px] font-semibold leading-6 text-foreground">{title}</h2>
        <div className="truncate text-[12px] font-medium leading-4 text-muted-foreground">
          {subtitle}
        </div>
      </div>
    </div>
  );
}
