import { toast } from "sonner";
import type { LibraryFolder, LibraryTrack } from "../../../../shared/library";
import { getArtworkSrc } from "@/lib/artwork";
import type { Translate } from "@/lib/i18n";

const richToastDuration = 2600;
const simpleToastDuration = 2200;

export function showTrackActionToast({
  action,
  track,
  detail,
}: {
  action: string;
  track: LibraryTrack;
  detail?: string;
}) {
  toast.custom(
    () => {
      const artworkSrc = getArtworkSrc(track);

      return (
        <div className="flex w-[320px] items-center gap-3 rounded-[20px] border border-white/10 bg-[rgba(10,10,10,0.96)] p-3 text-foreground shadow-2xl backdrop-blur-xl">
          <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-[14px] bg-white/10 text-[16px] font-semibold text-muted-foreground">
            {artworkSrc ? (
              <img className="size-full object-contain" src={artworkSrc} alt="" draggable={false} />
            ) : (
              <span>{track.title.slice(0, 1).toUpperCase()}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold leading-4 text-primary">{action}</p>
            <p className="mt-0.5 truncate text-[13px] font-semibold leading-4 text-foreground">
              {track.title}
            </p>
            <p className="mt-0.5 truncate text-[12px] font-medium leading-4 text-muted-foreground">
              {detail || track.artist}
            </p>
          </div>
        </div>
      );
    },
    { duration: richToastDuration, unstyled: true },
  );
}

/**
 * `showFolderActionToast` is called from event handlers rather than rendered as a
 * component, so it has no hook context: the caller passes the translator in, exactly
 * as it already does for `action` on `showTrackActionToast`.
 */
export function showFolderActionToast({
  folder,
  trackCount,
  t,
}: {
  folder: LibraryFolder;
  trackCount: number;
  t: Translate;
}) {
  const scannedLabel =
    trackCount === 1
      ? t("toast.trackScanned", { count: trackCount })
      : t("toast.tracksScanned", { count: trackCount });
  toast.custom(
    () => (
      <div className="flex w-[320px] items-center gap-3 rounded-[20px] border border-white/10 bg-[rgba(10,10,10,0.96)] p-3 text-foreground shadow-2xl backdrop-blur-xl">
        <div className="grid size-12 shrink-0 place-items-center rounded-[14px] bg-white/10 text-[16px] font-semibold text-primary">
          {folder.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold leading-4 text-primary">
            {t("toast.folderAdded")}
          </p>
          <p className="mt-0.5 truncate text-[13px] font-semibold leading-4 text-foreground">
            {folder.name}
          </p>
          <p className="mt-0.5 truncate text-[12px] font-medium leading-4 text-muted-foreground">
            {scannedLabel}
          </p>
        </div>
      </div>
    ),
    { duration: richToastDuration, unstyled: true },
  );
}

export function showSimpleActionToast(
  message: string,
  tone: "success" | "info" | "error" = "success",
) {
  const show = tone === "error" ? toast.error : tone === "info" ? toast.info : toast.success;
  show(message, { duration: simpleToastDuration });
}
