import type { ChannelLevels } from "@/features/audio/audio-engine";
import { useWindowDrag } from "@/hooks/use-window-drag";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import {
  createLedMeterCache,
  drawLedMeter,
  getLedMeterLayout,
  ledMeterHeight,
  type LedMeterCache,
  type LedMeterFrame,
} from "./meter-drawing";
import {
  createMeterChannelState,
  getHoldSegmentIndex,
  getLitSegmentCount,
  isMeterChannelAtRest,
  stepMeterChannel,
} from "./meter-model";

// Level meters read well at 20 fps. Drawing faster only makes the whole transparent window
// recomposite more often, so the loop sleeps between frames instead of running every vsync.
const frameIntervalMs = 50;
const reducedMotionFrameIntervalMs = 100;
const vsyncAllowanceMs = 16;
const playerRowGapPx = 10;

function isSameFrame(a: LedMeterFrame | null, b: LedMeterFrame): boolean {
  return (
    a !== null &&
    a.litSegments[0] === b.litSegments[0] &&
    a.litSegments[1] === b.litSegments[1] &&
    a.holdSegments[0] === b.holdSegments[0] &&
    a.holdSegments[1] === b.holdSegments[1]
  );
}

export function LevelsPanel({
  open,
  isPlaying,
  reduceMotion,
  readLevels,
}: {
  open: boolean;
  isPlaying: boolean;
  reduceMotion: boolean;
  readLevels: (target: ChannelLevels) => boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const channelsRef = useRef([createMeterChannelState(), createMeterChannelState()]);
  const levelsRef = useRef<ChannelLevels>({ peak: [0, 0] });
  const cacheRef = useRef<LedMeterCache | null>(null);
  const readLevelsRef = useRef(readLevels);
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(() => document.visibilityState === "visible");
  const windowDragHandlers = useWindowDrag<HTMLDivElement>();

  useEffect(() => {
    readLevelsRef.current = readLevels;
  }, [readLevels]);

  useEffect(() => {
    const onVisibilityChange = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  useEffect(() => {
    if (!open) return;
    const element = containerRef.current;
    if (!element) return;

    const update = () => setWidth(element.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [open]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!open || !visible || !canvas || !context || width === 0) return;

    const ratio = window.devicePixelRatio || 1;
    if (cacheRef.current?.key !== `${width}@${ratio}`) {
      cacheRef.current = createLedMeterCache(width, ratio);
    }
    const cache = cacheRef.current;
    if (!cache) return;

    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(ledMeterHeight * ratio);
    const { segmentCount } = getLedMeterLayout(width);
    const intervalMs = reduceMotion ? reducedMotionFrameIntervalMs : frameIntervalMs;
    let frame = 0;
    let timeout = 0;
    let lastTime = performance.now();
    let lastFrame: LedMeterFrame | null = null;

    const render = (time: number) => {
      const levels = levelsRef.current;
      const hasLevels = isPlaying && readLevelsRef.current(levels);
      const channels = channelsRef.current.map((state, channel) =>
        stepMeterChannel(
          state,
          hasLevels ? levels.peak[channel] : null,
          time / 1000,
          (time - lastTime) / 1000,
        ),
      );
      channelsRef.current = channels;
      lastTime = time;

      const nextFrame: LedMeterFrame = {
        litSegments: [
          getLitSegmentCount(channels[0].levelDb, segmentCount),
          getLitSegmentCount(channels[1].levelDb, segmentCount),
        ],
        holdSegments: [
          getHoldSegmentIndex(channels[0].holdDb, segmentCount),
          getHoldSegmentIndex(channels[1].holdDb, segmentCount),
        ],
      };
      if (!isSameFrame(lastFrame, nextFrame)) {
        drawLedMeter(context, cache, nextFrame);
        lastFrame = nextFrame;
      }

      const atRest = !isPlaying && channels.every(isMeterChannelAtRest);
      frame = 0;
      if (atRest) return;
      timeout = window.setTimeout(
        () => {
          frame = requestAnimationFrame(render);
        },
        Math.max(0, intervalMs - vsyncAllowanceMs),
      );
    };

    frame = requestAnimationFrame(render);
    return () => {
      window.clearTimeout(timeout);
      cancelAnimationFrame(frame);
    };
  }, [isPlaying, open, reduceMotion, visible, width]);

  // The meters sit at the top of the player and double as a handle for moving the window.
  // While collapsed, the negative margin cancels the player's row gap.
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          className="app-drag shrink-0 overflow-hidden"
          initial={{ height: 0, opacity: 0, marginBottom: -playerRowGapPx }}
          animate={{ height: "auto", opacity: 1, marginBottom: 0 }}
          exit={{ height: 0, opacity: 0, marginBottom: -playerRowGapPx }}
          transition={{ type: "spring", stiffness: 420, damping: 40, mass: 0.7 }}
          {...windowDragHandlers}
        >
          <div ref={containerRef}>
            <canvas
              ref={canvasRef}
              className="app-drag block w-full"
              style={{ height: ledMeterHeight }}
              role="img"
              aria-label="Left and right channel level meters"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
