import type { LibraryTrack } from "../../../../shared/library";
import { AnimatePresence, motion } from "framer-motion";
import { formatTime } from "@/lib/format";
import { useIcons } from "@/lib/icon-context";
import { TrackArtwork } from "@/features/tracks/TrackArtwork";
import { IconButton } from "./IconButton";
import {
  PlayPauseMorphIcon,
  SkipBackFilledIcon,
  SkipForwardFilledIcon,
} from "./media-icons";
import type { RepeatMode } from "./types";
import { WaveformEmptyState } from "./WaveformEmptyState";

export function Player({
  activeTrack,
  isPlaying,
  isLoading,
  hasWaveform,
  isFavorite,
  currentTime,
  duration,
  error,
  canvasRef,
  shuffleEnabled,
  repeatMode,
  onTogglePlayback,
  onPreviousTrack,
  onNextTrack,
  onToggleShuffle,
  onCycleRepeat,
  onToggleFavorite,
  onSeekPointer,
  onPointerScrubStart,
  onPointerScrubMove,
  onPointerScrubEnd,
}: {
  activeTrack: LibraryTrack | null;
  isPlaying: boolean;
  isLoading: boolean;
  hasWaveform: boolean;
  isFavorite: boolean;
  currentTime: number;
  duration: number;
  error: string;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  shuffleEnabled: boolean;
  repeatMode: RepeatMode;
  onTogglePlayback: () => void;
  onPreviousTrack: () => void;
  onNextTrack: () => void;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
  onToggleFavorite: () => void;
  onSeekPointer: (clientX: number) => void;
  onPointerScrubStart: () => void;
  onPointerScrubMove: () => boolean;
  onPointerScrubEnd: () => void;
}) {
  const icons = useIcons();
  const HeartIcon = icons.heart;
  const MusicIcon = icons.music;
  const ShuffleIcon = icons.shuffle;
  const RepeatIcon = icons.repeat;

  return (
    <section className="flex shrink-0 flex-col gap-[10px] px-4 pt-4 overflow-hidden">
      <div className="flex h-[60px] items-center gap-3">
        <div className="relative size-16 shrink-0 overflow-hidden rounded-[12px]">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={activeTrack?.id || "empty-artwork"}
              className="absolute inset-0"
              initial={{ opacity: 0, scale: 0.92, y: 6, filter: "blur(8px)" }}
              animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 0.96, y: -4, filter: "blur(8px)" }}
              transition={{
                type: "spring",
                stiffness: 520,
                damping: 36,
                mass: 0.72,
                opacity: { duration: 0.16 },
                filter: { duration: 0.22 },
              }}
            >
              {activeTrack ? (
                <TrackArtwork track={activeTrack} fallbackIcon={MusicIcon} size="lg" />
              ) : (
                <div className="grid size-16 place-items-center rounded-[12px] bg-white/10 text-muted-foreground">
                  <MusicIcon size={24} strokeWidth={1.6} />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="min-w-0 flex-1">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activeTrack?.id || "empty-title"}
                initial={{ opacity: 0, y: 7, filter: "blur(7px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -5, filter: "blur(7px)" }}
                transition={{
                  type: "spring",
                  stiffness: 500,
                  damping: 36,
                  mass: 0.68,
                  opacity: { duration: 0.15 },
                  filter: { duration: 0.2 },
                }}
              >
                <motion.h1
                  className="truncate text-[16px] font-semibold leading-[1.2]"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.03, duration: 0.16 }}
                >
                  {activeTrack?.title || "No track selected"}
                </motion.h1>
                <motion.p
                  className="mt-1 truncate text-[14px] font-medium leading-[1.25] text-muted-foreground"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.07, duration: 0.16 }}
                >
                  {activeTrack ? activeTrack.artist : "Double-click a track to play"}
                </motion.p>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex shrink-0 items-center gap-4 text-[13px] font-medium tabular-nums text-muted-foreground">
            <button
              className={`no-drag transition hover:text-foreground disabled:opacity-40 ${
                isFavorite ? "text-primary" : "text-muted-foreground"
              }`}
              title={isFavorite ? "Remove favorite" : "Favorite"}
              disabled={!activeTrack}
              onClick={onToggleFavorite}
            >
              <HeartIcon size={18} strokeWidth={1.7} fill={isFavorite ? "currentColor" : "none"} />
            </button>
          </div>
        </div>
      </div>

      <div className="relative mt-4 flex flex-col">
        <div className="relative h-[74px] overflow-hidden rounded-[20px]">
          <motion.div
            className="absolute inset-0"
            animate={{
              opacity: hasWaveform ? 1 : 0,
              y: hasWaveform ? 0 : 7,
              filter: hasWaveform ? "blur(0px)" : "blur(8px)",
            }}
            transition={{
              type: "spring",
              stiffness: 360,
              damping: 32,
              mass: 0.78,
              opacity: { duration: 0.22 },
              filter: { duration: 0.28 },
            }}
          >
            <canvas
              ref={canvasRef}
              className="no-drag h-full w-full rounded-[2px]"
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                onPointerScrubStart();
                onSeekPointer(event.clientX);
              }}
              onPointerMove={(event) => {
                if (onPointerScrubMove()) onSeekPointer(event.clientX);
              }}
              onPointerUp={(event) => {
                event.currentTarget.releasePointerCapture(event.pointerId);
                onPointerScrubEnd();
              }}
              onPointerCancel={onPointerScrubEnd}
            />
          </motion.div>

          <AnimatePresence mode="wait">
            {!hasWaveform && (
              <WaveformEmptyState
                key={activeTrack ? "loading-waveform" : "empty-waveform"}
                isLoading={isLoading}
                hasTrack={Boolean(activeTrack)}
              />
            )}
          </AnimatePresence>
        </div>
        <div className="flex items-center justify-between pt-1 text-[10px] font-medium leading-none tabular-nums text-muted-foreground">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="flex items-center justify-center gap-3 py-1">
        <IconButton
          title={shuffleEnabled ? "Shuffle on" : "Shuffle"}
          active={shuffleEnabled}
          onClick={onToggleShuffle}
        >
          <ShuffleIcon size={20} strokeWidth={1.8} />
        </IconButton>
        <div className="flex items-center gap-[6px]">
          <IconButton
            title="Previous"
            onClick={onPreviousTrack}
            disabled={!activeTrack || isLoading}
          >
            <SkipBackFilledIcon size={16} />
          </IconButton>
          <button
            className="no-drag grid size-12 place-items-center rounded-full bg-white text-black transition duration-150 hover:bg-white/90 active:scale-[0.98] disabled:opacity-40"
            title={isPlaying ? "Pause" : "Play"}
            onClick={onTogglePlayback}
            disabled={!activeTrack || isLoading}
          >
            <span className="relative grid size-6 place-items-center overflow-hidden">
              <PlayPauseMorphIcon
                playing={isPlaying}
                size={24}
                className={isPlaying ? "" : "translate-x-px"}
              />
            </span>
          </button>
          <IconButton title="Next" onClick={onNextTrack} disabled={!activeTrack || isLoading}>
            <SkipForwardFilledIcon size={16} />
          </IconButton>
        </div>
        <IconButton
          title={
            repeatMode === "one" ? "Repeat one" : repeatMode === "all" ? "Repeat all" : "Repeat"
          }
          active={repeatMode !== "off"}
          onClick={onCycleRepeat}
        >
          <span className="relative grid place-items-center">
            <RepeatIcon size={20} strokeWidth={1.8} />
            {repeatMode === "one" && (
              <span className="absolute -right-1 -top-1 grid size-3 place-items-center rounded-full bg-primary text-[8px] font-bold leading-none text-black">
                1
              </span>
            )}
          </span>
        </IconButton>
      </div>

      <div className="h-4 text-center text-[12px] leading-4 text-muted-foreground">{error}</div>
    </section>
  );
}
