import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { DragRegionBlocker } from "@/components/ui/drag-region-blocker";
import { showSimpleActionToast } from "@/features/toasts/action-toasts";
import { formatTime } from "@/lib/format";
import { useIcons } from "@/lib/icon-context";
import type { LibraryTrack, SoundCloudComment } from "../../../../shared/library";
import { IconButton } from "./IconButton";
import type { PlaybackClock } from "./playback-clock";

/** Posts a SoundCloud comment pinned to the playhead position when the box was opened. */
export function CommentComposer({
  track,
  playbackClock,
  onPosted,
}: {
  track: LibraryTrack;
  playbackClock: PlaybackClock;
  onPosted: (trackId: string, comment: SoundCloudComment) => void;
}) {
  const icons = useIcons();
  const CommentIcon = icons["message-circle"];
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<{ time: number } | null>(null);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // A new track invalidates the pinned time.
  useEffect(() => setOpen(null), [track.id]);

  const submit = async () => {
    const soundcloud = track.soundcloud;
    if (!soundcloud || !open || !body.trim() || posting) return;
    setPosting(true);
    try {
      const comment = await window.playhead.postSoundCloudComment(
        soundcloud.id,
        soundcloud.urn,
        body,
        open.time,
      );
      onPosted(track.id, comment);
      setBody("");
      setOpen(null);
    } catch (error) {
      showSimpleActionToast(
        error instanceof Error ? error.message : "Could not post the comment.",
        "error",
      );
    } finally {
      setPosting(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative shrink-0"
      onKeyDown={(event) => event.stopPropagation()}
    >
      <IconButton
        title="Comment"
        tooltip={open ? "Close comment" : "Comment at this moment"}
        active={Boolean(open)}
        ariaExpanded={Boolean(open)}
        onClick={() => setOpen((current) => (current ? null : { time: playbackClock.getTime() }))}
      >
        <CommentIcon size={19} strokeWidth={1.8} />
      </IconButton>
      {open && <DragRegionBlocker />}
      <AnimatePresence>
        {open && (
          <motion.form
            className="no-drag absolute right-0 top-full z-50 mt-2 w-[320px] rounded-[18px] border border-white/10 bg-[rgba(10,10,10,0.96)] p-2 shadow-[0_24px_60px_rgba(0,0,0,0.45)]"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 520, damping: 36, mass: 0.6 }}
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <div className="flex items-center gap-2">
              <input
                autoFocus
                className="selectable h-9 min-w-0 flex-1 rounded-full border border-white/10 bg-black/30 px-3 text-[13px] font-medium text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/70"
                placeholder={`Comment at ${formatTime(open.time)}`}
                value={body}
                maxLength={500}
                disabled={posting}
                onChange={(event) => setBody(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setOpen(null);
                }}
              />
              <button
                type="submit"
                className="h-9 rounded-full bg-primary px-3 text-[13px] font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-45"
                disabled={posting || !body.trim()}
              >
                Post
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
