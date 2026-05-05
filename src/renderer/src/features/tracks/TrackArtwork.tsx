import type { LibraryTrack } from "../../../../shared/library";
import { getArtworkSrc } from "@/lib/artwork";

export function TrackArtwork({
  track,
  fallbackIcon: FallbackIcon,
  size = "sm",
}: {
  track: LibraryTrack;
  fallbackIcon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  size?: "sm" | "lg";
}) {
  const artworkSrc = getArtworkSrc(track);
  const sizeClass = size === "lg" ? "size-16" : "size-10";
  const iconSize = size === "lg" ? 24 : 18;

  return (
    <div
      className={`grid ${sizeClass} shrink-0 place-items-center overflow-hidden rounded-[12px] bg-white/10`}
    >
      {artworkSrc ? (
        <img className="size-full object-contain" src={artworkSrc} alt="" draggable={false} />
      ) : (
        <FallbackIcon size={iconSize} strokeWidth={1.6} />
      )}
    </div>
  );
}
