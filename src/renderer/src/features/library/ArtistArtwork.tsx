import type { LibraryArtist } from "./library-model";

type ArtistArtworkSize = "sm" | "md";
type ArtistFallbackIcon = React.ComponentType<{
  size?: number;
  strokeWidth?: number;
  className?: string;
}>;

function getArtworkSrc(artwork: LibraryArtist["artworkSet"][number]): string | null {
  return artwork?.dataUrl || artwork?.src || null;
}

export function ArtistArtwork({
  artist,
  fallbackIcon: FallbackIcon,
  size = "sm",
}: {
  artist: LibraryArtist;
  fallbackIcon: ArtistFallbackIcon;
  size?: ArtistArtworkSize;
}) {
  const artworkSet = artist.artworkSet
    .map(getArtworkSrc)
    .filter((src): src is string => Boolean(src));
  const sizeClass = size === "md" ? "size-12 rounded-[14px]" : "size-10 rounded-[12px]";
  const iconSize = size === "md" ? 20 : 18;

  if (artworkSet.length === 0) {
    return (
      <div
        className={`grid ${sizeClass} shrink-0 place-items-center overflow-hidden bg-white/10 text-muted-foreground`}
      >
        <FallbackIcon size={iconSize} strokeWidth={1.8} />
      </div>
    );
  }

  if (artworkSet.length === 1) {
    return (
      <div className={`grid ${sizeClass} shrink-0 place-items-center overflow-hidden bg-white/10`}>
        <img className="size-full object-cover" src={artworkSet[0]} alt="" draggable={false} />
      </div>
    );
  }

  return (
    <div
      className={`grid ${sizeClass} shrink-0 grid-cols-2 grid-rows-2 overflow-hidden bg-white/10`}
    >
      {artworkSet.slice(0, 4).map((src, index) => (
        <img
          key={`${src}-${index}`}
          className={`size-full object-cover ${artworkSet.length === 2 ? "row-span-2" : ""} ${
            artworkSet.length === 3 && index === 0 ? "row-span-2" : ""
          }`}
          src={src}
          alt=""
          draggable={false}
        />
      ))}
    </div>
  );
}
