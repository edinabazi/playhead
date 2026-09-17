import { useEffect, useRef } from "react";
import {
  getRestingBarPose,
  sampleNowPlayingBar,
  subscribeToNowPlayingTicks,
  type BarPose,
} from "./now-playing-bars";

const barDelays = [0.22, 0, 0.33, 0.11];

function applyPose(element: HTMLSpanElement | null, pose: BarPose) {
  if (!element) return;
  element.style.transform = `scaleY(${pose.scale.toFixed(3)})`;
  element.style.opacity = pose.opacity.toFixed(3);
}

export function NowPlayingBars({ heights, className }: { heights: number[]; className: string }) {
  const barRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    const reduceMotion = Boolean(barRefs.current[0]?.closest(".reduce-motion"));
    return subscribeToNowPlayingTicks((timeSeconds) => {
      barRefs.current.forEach((element, index) => {
        const delay = barDelays[index % barDelays.length];
        applyPose(
          element,
          timeSeconds === null || reduceMotion
            ? getRestingBarPose(delay)
            : sampleNowPlayingBar(timeSeconds, delay),
        );
      });
    });
  }, []);

  return (
    <span className={className}>
      {heights.map((height, index) => (
        <span
          key={index}
          ref={(element) => {
            barRefs.current[index] = element;
          }}
          className="w-[2px] rounded-full bg-current"
          style={{ height }}
        />
      ))}
    </span>
  );
}
