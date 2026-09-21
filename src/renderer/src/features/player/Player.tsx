import type { EqualizerSettings, LibraryTag, LibraryTrack } from "../../../../shared/library";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useId, useRef, useState } from "react";
import { SliderComfortable } from "@/components/ui/slider";
import { SoundPanel } from "@/features/audio/SoundPanel";
import { formatTime } from "@/lib/format";
import { useIcons } from "@/lib/icon-context";
import type { MenuAnchorPoint } from "@/lib/menu-position";
import { useWindowDrag } from "@/hooks/use-window-drag";
import { FavoriteHeartButton } from "@/features/tracks/FavoriteHeartButton";
import { TrackArtwork } from "@/features/tracks/TrackArtwork";
import { IconButton } from "./IconButton";
import { PlayPauseMorphIcon, SkipBackFilledIcon, SkipForwardFilledIcon } from "./media-icons";
import type { RepeatMode } from "./types";
import { WaveformEmptyState } from "./WaveformEmptyState";

function formatAudioFormat(track: LibraryTrack): string {
  if (track.source === "soundcloud" || track.soundcloud) {
    return track.bpm ? "" : "Sourced from SoundCloud";
  }
  const extension = track.fileName.split(".").pop() || "";
  const format = extension || track.audioFormat || "";
  return format.toUpperCase();
}

function formatBitRate(bitRate?: number): string | null {
  if (!bitRate) return null;
  return `${Math.round(bitRate / 1000)} kbps`;
}

function formatBpm(bpm?: number): string | null {
  if (!bpm) return null;
  return `${Math.round(bpm)} BPM`;
}

export function Player({
  activeTrack,
  activeTags,
  isPlaying,
  isLoading,
  hasWaveform,
  shouldAnimateWaveform,
  reduceMotion,
  isFavorite,
  currentTime,
  duration,
  waveformRef,
  shuffleEnabled,
  repeatMode,
  volume,
  maxVolume,
  volumeBoostEnabled,
  limiterActive,
  equalizer,
  onTogglePlayback,
  onPreviousTrack,
  onNextTrack,
  onToggleShuffle,
  onCycleRepeat,
  onToggleFavorite,
  onTrackInfoContextMenu,
  onVolumeChange,
  onVolumeBoostChange,
  onEqualizerPreview,
  onEqualizerChange,
}: {
  activeTrack: LibraryTrack | null;
  activeTags: LibraryTag[];
  isPlaying: boolean;
  isLoading: boolean;
  hasWaveform: boolean;
  shouldAnimateWaveform: boolean;
  reduceMotion: boolean;
  isFavorite: boolean;
  currentTime: number;
  duration: number;
  waveformRef: React.Ref<HTMLDivElement>;
  shuffleEnabled: boolean;
  repeatMode: RepeatMode;
  volume: number;
  maxVolume: number;
  volumeBoostEnabled: boolean;
  limiterActive: boolean;
  equalizer: EqualizerSettings;
  onTogglePlayback: () => void;
  onPreviousTrack: () => void;
  onNextTrack: () => void;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
  onToggleFavorite: () => void;
  onTrackInfoContextMenu: (point: MenuAnchorPoint) => void;
  onVolumeChange: (volume: number) => void;
  onVolumeBoostChange: (enabled: boolean) => void;
  onEqualizerPreview: (equalizer: EqualizerSettings) => void;
  onEqualizerChange: (equalizer: EqualizerSettings) => void;
}) {
  const windowDragHandlers = useWindowDrag<HTMLDivElement>();
  const icons = useIcons();
  const MusicIcon = icons.music;
  const ShuffleIcon = icons.shuffle;
  const RepeatIcon = icons.repeat;
  const VolumeIcon = icons["volume-2"];
  const SoundIcon = icons["sliders-horizontal"];
  const soundPanelId = useId();
  const soundControlsRef = useRef<HTMLDivElement>(null);
  const [soundPanelOpen, setSoundPanelOpen] = useState(false);

  useEffect(() => {
    if (!soundPanelOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!soundControlsRef.current?.contains(event.target as Node)) setSoundPanelOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSoundPanelOpen(false);
        soundControlsRef.current?.querySelector("button")?.focus();
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [soundPanelOpen]);
  const trackInfo = activeTrack
    ? [
        formatAudioFormat(activeTrack),
        formatBitRate(activeTrack.bitRate),
        formatBpm(activeTrack.bpm),
      ].filter((part): part is string => Boolean(part))
    : [];
  const visibleTags = activeTags.slice(0, 3);
  const hiddenTagCount = Math.max(0, activeTags.length - visibleTags.length);

  return (
    <section className="@container relative flex shrink-0 flex-col gap-[10px] px-4 pt-4">
      <div className="app-drag flex h-16 items-center gap-3" {...windowDragHandlers}>
        <div
          className="no-drag flex min-w-0 flex-1 items-center gap-3"
          onContextMenu={(event) => {
            if (!activeTrack) return;
            event.preventDefault();
            event.stopPropagation();
            onTrackInfoContextMenu({ x: event.clientX, y: event.clientY, align: "left" });
          }}
        >
          <div className="relative size-16 shrink-0 rounded-[12px]">
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
                <motion.div
                  className="flex min-w-0 items-center gap-2"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.03, duration: 0.16 }}
                >
                  <h1 className="min-w-0 truncate text-[16px] font-semibold leading-[1.2]">
                    {activeTrack?.title || "No track selected"}
                  </h1>
                  {visibleTags.length > 0 && (
                    <div className="flex min-w-0 shrink-0 items-center gap-1">
                      {visibleTags.map((tag) => (
                        <span
                          key={tag.id}
                          className="max-w-[92px] truncate rounded-full border border-white/10 bg-white/[0.045] px-2 py-1 text-[11px] font-medium leading-none text-muted-foreground"
                        >
                          {tag.name}
                        </span>
                      ))}
                      {hiddenTagCount > 0 && (
                        <span className="rounded-full border border-white/10 bg-white/[0.045] px-2 py-1 text-[11px] font-medium leading-none text-muted-foreground">
                          +{hiddenTagCount}
                        </span>
                      )}
                    </div>
                  )}
                </motion.div>
                <motion.p
                  className="mt-0.5 truncate text-[14px] font-medium leading-[1.25] text-muted-foreground"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.07, duration: 0.16 }}
                >
                  {activeTrack ? activeTrack.artist : "Double-click a track to play"}
                </motion.p>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <div className="no-drag flex shrink-0 items-center gap-4 text-[13px] font-medium tabular-nums text-muted-foreground">
          <FavoriteHeartButton
            active={isFavorite}
            disabled={!activeTrack}
            tooltipSide="left"
            onClick={onToggleFavorite}
          />
        </div>
      </div>

      <div className="relative mt-4 flex flex-col">
        <div className="relative h-[74px] overflow-hidden rounded-[20px]">
          <motion.div className="absolute inset-0 overflow-hidden rounded-[2px]">
            <motion.div
              className="h-full origin-left"
              animate={{
                clipPath: hasWaveform ? "inset(0% 0% 0% 0%)" : "inset(0% 100% 0% 0%)",
                opacity: hasWaveform ? 1 : 0,
              }}
              transition={{
                clipPath: {
                  duration: reduceMotion || !shouldAnimateWaveform ? 0 : 0.55,
                  ease: [0.22, 1, 0.36, 1],
                },
                opacity: {
                  duration: reduceMotion || !shouldAnimateWaveform ? 0 : hasWaveform ? 0.08 : 0.18,
                },
              }}
            >
              <div ref={waveformRef} className="no-drag h-full w-full rounded-[2px]" />
            </motion.div>
          </motion.div>

          <AnimatePresence mode="wait">
            {!hasWaveform && (
              <WaveformEmptyState
                key={activeTrack ? "loading-waveform" : "empty-waveform"}
                isLoading={(isLoading && shouldAnimateWaveform) || !activeTrack}
                reduceMotion={reduceMotion}
              />
            )}
          </AnimatePresence>
        </div>
        <div className="flex items-center justify-between pt-1 text-[10px] font-medium leading-none tabular-nums text-muted-foreground">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center py-1">
        <div className="flex min-w-0 items-center gap-2 pr-4">
          <div
            ref={soundControlsRef}
            className="relative shrink-0"
            onKeyDown={(event) => {
              if (event.key === " " || event.key === "Enter") event.stopPropagation();
            }}
          >
            <IconButton
              title="Sound"
              ariaExpanded={soundPanelOpen}
              ariaControls={soundPanelId}
              active={soundPanelOpen || equalizer.enabled}
              onClick={() => setSoundPanelOpen((value) => !value)}
            >
              <SoundIcon size={19} strokeWidth={1.8} />
            </IconButton>
            <SoundPanel
              open={soundPanelOpen}
              id={soundPanelId}
              equalizer={equalizer}
              volumeBoostEnabled={volumeBoostEnabled}
              onEqualizerPreview={onEqualizerPreview}
              onEqualizerChange={onEqualizerChange}
              onVolumeBoostChange={onVolumeBoostChange}
            />
          </div>
          {trackInfo.length > 0 && (
            <div className="min-w-0 truncate text-[12px] font-medium leading-normal text-muted-foreground @max-lg:hidden">
              {trackInfo.join(" · ")}
            </div>
          )}
        </div>
        <div className="flex items-center justify-center gap-3 @max-lg:gap-1">
          <IconButton
            title={shuffleEnabled ? "Shuffle on" : "Shuffle"}
            active={shuffleEnabled}
            motionType="shuffle"
            onClick={onToggleShuffle}
          >
            <ShuffleIcon size={20} strokeWidth={1.8} />
          </IconButton>
          <div className="flex items-center gap-[6px]">
            <IconButton
              title="Previous"
              onClick={onPreviousTrack}
              disabled={!activeTrack || isLoading}
              motionType="previous"
            >
              <SkipBackFilledIcon size={16} />
            </IconButton>
            <motion.button
              className="no-drag relative grid size-12 place-items-center overflow-hidden rounded-full bg-white text-black shadow-[0_0_0_0_rgba(255,255,255,0)]"
              title={isPlaying ? "Pause" : "Play"}
              onClick={onTogglePlayback}
              disabled={!activeTrack || isLoading}
              whileHover={
                !activeTrack || isLoading
                  ? undefined
                  : {
                      scale: 1.07,
                      y: -2,
                      boxShadow:
                        "0 14px 34px rgba(255,255,255,0.14), 0 0 0 1px rgba(255,255,255,0.46)",
                    }
              }
              whileTap={!activeTrack || isLoading ? undefined : { scale: 0.9, y: 0 }}
              transition={{ type: "spring", stiffness: 620, damping: 28, mass: 0.58 }}
            >
              <motion.span
                className="pointer-events-none absolute inset-0 rounded-full"
                initial={false}
                animate={{
                  opacity: isPlaying ? 0.32 : 0.14,
                  background:
                    "radial-gradient(circle at 50% 38%, rgba(255,255,255,1), rgba(255,255,255,0.14) 54%, rgba(0,0,0,0) 72%)",
                }}
                transition={{ duration: 0.16 }}
              />
              <motion.span
                className="relative grid size-6 place-items-center overflow-hidden"
                initial={false}
                animate={{ rotate: isPlaying ? 0 : 0, scale: isPlaying ? 0.96 : 1 }}
                whileHover={!activeTrack || isLoading ? undefined : { scale: 1.09 }}
                transition={{ type: "spring", stiffness: 680, damping: 24, mass: 0.5 }}
              >
                <PlayPauseMorphIcon
                  playing={isPlaying}
                  size={24}
                  className={isPlaying ? "" : "translate-x-px"}
                />
              </motion.span>
            </motion.button>
            <IconButton
              title="Next"
              onClick={onNextTrack}
              disabled={!activeTrack || isLoading}
              motionType="next"
            >
              <SkipForwardFilledIcon size={16} />
            </IconButton>
          </div>
          <IconButton
            title={
              repeatMode === "one" ? "Repeat one" : repeatMode === "all" ? "Repeat all" : "Repeat"
            }
            active={repeatMode !== "off"}
            motionType="repeat"
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
        <div className="no-drag ml-auto flex items-center gap-2">
          {(volumeBoostEnabled || limiterActive) && (
            <span
              className={`rounded-[4px] border px-1 py-0.5 font-mono text-[10px] font-semibold leading-none transition-colors duration-100 @max-lg:hidden ${
                limiterActive
                  ? "border-red-400/60 bg-red-500/15 text-red-300"
                  : "border-white/10 text-muted-foreground/60"
              }`}
              title="Limiter"
            >
              LIM
            </span>
          )}
          <div className="relative w-[152px] @max-lg:w-[120px]">
            {maxVolume > 1 && (
              <span
                className="pointer-events-none absolute -top-1.5 h-1 w-px bg-white/30"
                style={{ left: `${100 / maxVolume}%` }}
              />
            )}
            <SliderComfortable
              value={Math.round(volume * 100)}
              min={0}
              max={Math.round(maxVolume * 100)}
              step={1}
              variant="scrubber"
              label={
                <VolumeIcon
                  size={15}
                  strokeWidth={1.8}
                  className={limiterActive ? "@max-lg:text-red-300" : undefined}
                />
              }
              formatValue={(value) => `${Math.round(value)}%`}
              className="h-7 border-white/10 bg-white/[0.045]"
              onChange={(value) => onVolumeChange(value / 100)}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
