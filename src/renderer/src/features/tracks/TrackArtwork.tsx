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
  const radiusClass = size === "lg" ? "rounded-[12px]" : "rounded-md";
  const imageRadiusClass = size === "lg" ? "rounded-[12px]" : "rounded-[6px]";
  const iconSize = size === "lg" ? 24 : 18;
  const badgeClass =
    size === "lg"
      ? "bottom-0 right-0 h-5 rounded-md translate-1/12"
      : "bottom-0 right-0 h-4 rounded-[4px] translate-1/4";
  const isSoundCloudTrack = track.source === "soundcloud" || Boolean(track.soundcloud);

  return (
    <div
      className={`relative grid ${sizeClass} ${radiusClass} shrink-0 place-items-center bg-white/10`}
    >
      {artworkSrc ? (
        <img
          className={`size-full object-contain ${imageRadiusClass}`}
          src={artworkSrc}
          alt=""
          draggable={false}
        />
      ) : (
        <FallbackIcon size={iconSize} strokeWidth={1.6} />
      )}
      {isSoundCloudTrack && (
        <span
          className={`absolute ${badgeClass} aspect-square grid place-items-center bg-[#FF5500] text-white shadow-[0_0_0_1px_rgba(0,0,0,0.32),0_4px_10px_rgba(0,0,0,0.28)]`}
          aria-hidden="true"
        >
          <SoundCloudMark />
        </span>
      )}
    </div>
  );
}

function SoundCloudMark() {
  return (
    <svg className="h-[58%] w-[76%]" viewBox="0 0 75 33.51" fill="currentColor">
      <path d="M75,23.6a10.5,10.5,0,0,1-10.63,9.91H38.82a2.14,2.14,0,0,1-2.12-2.13V3.87a2.34,2.34,0,0,1,1.41-2.24S40.46,0,45.41,0A16.74,16.74,0,0,1,54,2.36a17,17,0,0,1,8,11.08,9.8,9.8,0,0,1,2.71-.37A10.23,10.23,0,0,1,75,23.6Z" />
      <path d="M33.51,5.61a.83.83,0,1,0-1.65,0c-.7,9.25-1.24,17.92,0,27.14a.83.83,0,0,0,1.65,0C34.84,23.45,34.28,14.94,33.51,5.61Z" />
      <path d="M28.35,8.81a.87.87,0,0,0-1.73,0,103.7,103.7,0,0,0,0,23.95.87.87,0,0,0,1.72,0A93.2,93.2,0,0,0,28.35,8.81Z" />
      <path d="M23.16,8a.84.84,0,0,0-1.67,0c-.79,8.44-1.19,16.32,0,24.74a.83.83,0,0,0,1.66,0C24.38,24.21,24,16.55,23.16,8Z" />
      <path d="M18,10.41a.86.86,0,0,0-1.72,0,87.61,87.61,0,0,0,0,22.36.85.85,0,0,0,1.69,0A81.68,81.68,0,0,0,18,10.41Z" />
      <path d="M12.79,16a.85.85,0,0,0-1.7,0c-1.23,5.76-.65,11,.05,16.83a.81.81,0,0,0,1.6,0C13.51,26.92,14.1,21.8,12.79,16Z" />
      <path d="M7.62,15.12a.88.88,0,0,0-1.75,0C4.78,21,5.14,26.18,5.9,32.05c.08.89,1.59.88,1.69,0C8.43,26.09,8.82,21.06,7.62,15.12Z" />
      <path d="M2.4,18A.88.88,0,0,0,.65,18c-1,3.95-.69,7.22.07,11.18a.82.82,0,0,0,1.63,0C3.23,25.14,3.66,21.94,2.4,18Z" />
    </svg>
  );
}
