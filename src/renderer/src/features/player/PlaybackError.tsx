import type { PlaybackFailure } from "../../../../shared/playback";
import { Button } from "@/components/ui/button";
import { useIcons } from "@/lib/icon-context";

export function PlaybackError({
  failure,
  onRetry,
}: {
  failure: PlaybackFailure;
  onRetry: () => void;
}) {
  const icons = useIcons();
  const InfoIcon = icons.info;
  return (
    <div
      role="alert"
      className="no-drag absolute inset-0 flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.035] px-3"
    >
      <InfoIcon size={17} strokeWidth={1.5} className="shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-medium leading-tight">{failure.title}</p>
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{failure.message}</p>
      </div>
      <Button
        variant="secondary"
        size="sm"
        leadingIcon={icons["rotate-ccw"]}
        className="shrink-0"
        onClick={onRetry}
        onKeyDown={(event) => {
          if (event.key === " " || event.key === "Enter") event.stopPropagation();
        }}
      >
        Retry
      </Button>
    </div>
  );
}
