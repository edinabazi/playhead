import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useIcons } from "@/lib/icon-context";
import { useTranslation } from "@/lib/i18n";
import type { LibraryScanProgress } from "../../../../shared/library-scan";

export function LibraryScanStatus({ scanId }: { scanId: string }) {
  const [progress, setProgress] = useState<LibraryScanProgress | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState(false);
  const icons = useIcons();
  const t = useTranslation();
  const FolderIcon = icons["folder-open"];
  useEffect(
    () =>
      window.playhead.onLibraryScanProgress((next) => {
        if (next.id === scanId) setProgress(next);
      }),
    [scanId],
  );
  if (!progress) return null;
  const reading = progress.phase === "reading";
  const finishing = progress.phase === "finishing";
  const percent = progress.discovered
    ? Math.min(100, Math.round((progress.processed / progress.discovered) * 100))
    : 0;
  const title = cancelling
    ? t("library.scan.cancelling")
    : finishing
      ? t("library.scan.finishing")
      : reading
        ? t("library.scan.readingTracks")
        : progress.phase === "queued"
          ? t("library.scan.queued")
          : t("library.scan.finding");
  const count = reading
    ? t("library.scan.tracksProgress", {
        current: progress.processed.toLocaleString(),
        total: progress.discovered.toLocaleString(),
      })
    : t("library.scan.foundTracks", { count: progress.discovered.toLocaleString() });
  return (
    <aside
      aria-label={t("library.scan.statusAria")}
      className="no-drag fixed bottom-4 right-4 z-[100] w-[340px] max-w-[calc(100vw-32px)] rounded-2xl border border-white/10 bg-[rgba(10,10,10,0.96)] p-3.5 shadow-xl backdrop-blur-xl"
    >
      <div className="flex items-center gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/5 text-muted-foreground">
          <FolderIcon size={17} strokeWidth={1.5} />
        </span>
        <div className="min-w-0 flex-1">
          <p role="status" className="text-[12px] font-medium">
            {title}
          </p>
          <p
            className="mt-0.5 truncate text-[11px] text-muted-foreground"
            title={progress.folderName}
          >
            {progress.folderName || t("library.scan.folderFallback")}
            {progress.folderCount > 1
              ? t("library.scan.folderProgressSuffix", {
                  current: progress.folderIndex || 1,
                  total: progress.folderCount,
                })
              : ""}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={cancelling || finishing}
          onKeyDown={(event) => {
            if (event.key === " " || event.key === "Enter") event.stopPropagation();
          }}
          onClick={() => {
            setCancelling(true);
            setCancelError(false);
            void window.playhead.cancelLibraryScan(scanId).catch(() => {
              setCancelling(false);
              setCancelError(true);
            });
          }}
        >
          {t("common.cancel")}
        </Button>
      </div>
      <div
        role="progressbar"
        aria-label={title}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={reading ? percent : undefined}
        aria-valuetext={count}
        className="mt-3 h-1 overflow-hidden rounded-full bg-white/10"
      >
        <div
          className={`h-full rounded-full bg-foreground/70 ${reading ? "transition-[width] duration-200 motion-reduce:transition-none" : "animate-pulse motion-reduce:animate-none"}`}
          style={{ width: reading ? `${percent}%` : "100%" }}
        />
      </div>
      <p className="mt-2 text-[11px] tabular-nums text-muted-foreground">
        {cancelError
          ? t("library.scan.cancelFailed")
          : finishing
            ? t("library.scan.savingTracks")
            : count}
      </p>
    </aside>
  );
}
