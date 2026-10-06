import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { formatTime } from "@/lib/format";
import type { SoundCloudComment } from "../../../../shared/library";
import type { PlaybackClock } from "./playback-clock";
import { bucketComments, findActiveComment } from "./waveform-comments";

// One avatar per slot keeps the DOM size fixed however many comments a track has.
const slotWidth = 18;
// Below this width faces get too crowded; show tick marks instead.
const minAvatarWidth = 360;
const bubbleWidth = 260;

export function WaveformComments({
  comments,
  duration,
  playbackClock,
  popupsEnabled,
  reduceMotion,
  onSeek,
}: {
  comments: SoundCloudComment[];
  duration: number;
  playbackClock: PlaybackClock;
  popupsEnabled: boolean;
  reduceMotion: boolean;
  onSeek: (time: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hovered, setHovered] = useState<{ comment: SoundCloudComment; position: number } | null>(
    null,
  );

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setWidth(element.clientWidth));
    observer.observe(element);
    setWidth(element.clientWidth);
    return () => observer.disconnect();
  }, []);

  const slots = useMemo(
    () => bucketComments(comments, duration, Math.floor(width / slotWidth)),
    [comments, duration, width],
  );

  // Re-render only when the comment under the playhead changes, not every frame.
  const getActiveIndex = useCallback(
    () => (popupsEnabled ? findActiveComment(comments, playbackClock.getTime()) : -1),
    [comments, playbackClock, popupsEnabled],
  );
  const activeIndex = useSyncExternalStore(playbackClock.subscribePrecise, getActiveIndex);
  const active = activeIndex === -1 ? null : comments[activeIndex];

  const bubble =
    hovered ??
    (active && duration
      ? { comment: active, position: Math.min(1, active.time / duration) }
      : null);
  const bubbleLeft = Math.max(
    4,
    Math.min(width - bubbleWidth - 4, (bubble?.position ?? 0) * width - 12),
  );
  const showAvatars = width >= minAvatarWidth;

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0 z-[1]">
      {slots.map((slot) => {
        const left = slot.position * width;
        const title = `${slot.comment.username} at ${formatTime(slot.comment.time)}${
          slot.count > 1 ? ` (+${slot.count - 1} more)` : ""
        }`;
        return (
          <button
            key={slot.comment.id}
            type="button"
            aria-label={title}
            className={`no-drag pointer-events-auto absolute -translate-x-1/2 ${
              showAvatars ? "bottom-1 size-4" : "bottom-1 h-2 w-[3px]"
            }`}
            style={{ left }}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onSeek(slot.comment.time);
            }}
            onMouseEnter={() => setHovered({ comment: slot.comment, position: slot.position })}
            onMouseLeave={() => setHovered(null)}
          >
            {showAvatars ? (
              slot.comment.avatarUrl ? (
                <img
                  src={slot.comment.avatarUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  className={`size-4 rounded-full object-cover ring-1 transition-transform hover:scale-125 ${
                    active?.id === slot.comment.id ? "ring-primary" : "ring-black/60"
                  }`}
                />
              ) : (
                <span className="block size-4 rounded-full bg-white/30 ring-1 ring-black/60" />
              )
            ) : (
              <span className="block size-full rounded-full bg-white/50" />
            )}
          </button>
        );
      })}
      <AnimatePresence>
        {bubble && width > 0 && (
          <motion.div
            key={bubble.comment.id}
            className="absolute bottom-6 flex max-w-[260px] items-start gap-2 rounded-[12px] border border-white/10 bg-[rgba(10,10,10,0.9)] px-2 py-1.5 text-[11px] leading-[1.3] shadow-lg"
            style={{ left: bubbleLeft, width: "max-content" }}
            initial={{ opacity: 0, y: reduceMotion ? 0 : 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ type: "spring", stiffness: 520, damping: 36, mass: 0.6 }}
          >
            <div className="min-w-0">
              <div className="flex items-baseline gap-1.5">
                <span className="truncate font-semibold text-foreground">
                  {bubble.comment.username}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {formatTime(bubble.comment.time)}
                </span>
              </div>
              <p className="line-clamp-1 break-words text-muted-foreground">
                {bubble.comment.body}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
