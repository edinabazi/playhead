import { useEffect, useRef, useState } from "react";
import type { EqualizerSettings } from "../../../../shared/library";
import { equalizerGainLimitDb, getEqualizerResponseDb } from "./equalizer";

const sliderTrackHeight = 104;
const sliderThumbHeight = 8;
const minFrequency = 20;
const frequencyDecades = 3;

function formatGain(gainDb: number): string {
  if (gainDb === 0) return "0";
  return `${gainDb > 0 ? "+" : ""}${gainDb}`;
}

export function EqualizerCurve({ settings }: { settings: EqualizerSettings }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(rect.width * ratio);
      canvas.height = Math.round(rect.height * ratio);
      const context = canvas.getContext("2d");
      if (!context || rect.width === 0) return;

      const styles = getComputedStyle(document.documentElement);
      const primary = styles.getPropertyValue("--primary").trim() || "#ffff00";
      const muted = styles.getPropertyValue("--text-tertiary").trim() || "#787672";
      const { width, height } = rect;
      const x = (frequency: number) =>
        (Math.log10(frequency / minFrequency) / frequencyDecades) * width;
      const y = (gainDb: number) => height / 2 - (gainDb / equalizerGainLimitDb) * (height / 2 - 6);

      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      context.lineWidth = 1;
      context.strokeStyle = "rgba(255,255,255,0.07)";
      for (const frequency of [100, 1000, 10000]) {
        context.beginPath();
        context.moveTo(x(frequency), 0);
        context.lineTo(x(frequency), height);
        context.stroke();
      }
      context.strokeStyle = "rgba(255,255,255,0.2)";
      context.beginPath();
      context.moveTo(0, y(0));
      context.lineTo(width, y(0));
      context.stroke();

      context.fillStyle = muted;
      context.font = "500 10px ui-monospace, SFMono-Regular, Menlo, monospace";
      context.fillText("100", x(100) + 4, height - 3);
      context.fillText("1k", x(1000) + 4, height - 3);
      context.fillText("10k", x(10000) + 4, height - 3);

      const points = Array.from({ length: 141 }, (_, index) => {
        const frequency = minFrequency * 10 ** ((index / 140) * frequencyDecades);
        const gainDb = Math.max(
          -equalizerGainLimitDb,
          Math.min(equalizerGainLimitDb, getEqualizerResponseDb(settings, frequency)),
        );
        return [x(frequency), y(gainDb)] as const;
      });

      context.beginPath();
      context.moveTo(0, y(0));
      points.forEach(([px, py]) => context.lineTo(px, py));
      context.lineTo(width, y(0));
      context.closePath();
      context.globalAlpha = 0.08;
      context.fillStyle = settings.enabled ? primary : muted;
      context.fill();
      context.globalAlpha = 1;

      context.beginPath();
      points.forEach(([px, py], index) =>
        index ? context.lineTo(px, py) : context.moveTo(px, py),
      );
      context.strokeStyle = settings.enabled ? primary : muted;
      context.lineWidth = 2;
      context.stroke();
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [settings]);

  return <canvas ref={canvasRef} className="block h-[84px] w-full" aria-hidden="true" />;
}

export function EqualizerBandSlider({
  label,
  ariaLabel,
  gainDb,
  disabled,
  onPreview,
  onCommit,
}: {
  label: string;
  ariaLabel: string;
  gainDb: number;
  disabled?: boolean;
  onPreview: (gainDb: number) => void;
  onCommit: (gainDb: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [pointerFocus, setPointerFocus] = useState(false);
  const latestGainRef = useRef(gainDb);
  const center = sliderTrackHeight / 2;
  const travel = center - sliderThumbHeight;
  const thumbTop = center - (gainDb / equalizerGainLimitDb) * travel;

  const gainFromPointer = (clientY: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return gainDb;
    const offset = center - (clientY - rect.top);
    return Math.round((offset / travel) * equalizerGainLimitDb * 2) / 2;
  };
  const clamp = (value: number) =>
    Math.max(-equalizerGainLimitDb, Math.min(equalizerGainLimitDb, value));
  const preview = (nextGainDb: number) => {
    latestGainRef.current = clamp(nextGainDb);
    onPreview(latestGainRef.current);
  };

  return (
    <div
      className={`flex min-w-0 flex-1 flex-col items-center gap-1.5 ${disabled ? "opacity-45" : ""}`}
    >
      <span className="h-3.5 font-mono text-[10px] leading-none text-muted-foreground tabular-nums">
        {formatGain(gainDb)}
      </span>
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-orientation="vertical"
        aria-valuemin={-equalizerGainLimitDb}
        aria-valuemax={equalizerGainLimitDb}
        aria-valuenow={gainDb}
        aria-valuetext={`${formatGain(gainDb)} dB`}
        className={`group relative w-[22px] cursor-ns-resize touch-none rounded-[6px] outline-none ${pointerFocus ? "" : "focus-visible:ring-1 focus-visible:ring-primary/70"}`}
        onBlur={() => setPointerFocus(false)}
        style={{ height: sliderTrackHeight }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          setPointerFocus(true);
          event.currentTarget.setPointerCapture(event.pointerId);
          draggingRef.current = true;
          preview(gainFromPointer(event.clientY));
        }}
        onPointerMove={(event) => {
          if (!draggingRef.current) return;
          preview(gainFromPointer(event.clientY));
        }}
        onPointerUp={() => {
          if (!draggingRef.current) return;
          draggingRef.current = false;
          onCommit(latestGainRef.current);
        }}
        onPointerCancel={() => {
          if (!draggingRef.current) return;
          draggingRef.current = false;
          onCommit(latestGainRef.current);
        }}
        onDoubleClick={() => onCommit(0)}
        onKeyDown={(event) => {
          setPointerFocus(false);
          const step = event.shiftKey ? 3 : 0.5;
          const nextGainDb =
            event.key === "ArrowUp" || event.key === "ArrowRight"
              ? gainDb + step
              : event.key === "ArrowDown" || event.key === "ArrowLeft"
                ? gainDb - step
                : event.key === "Home" || event.key === "0"
                  ? 0
                  : null;
          if (nextGainDb === null) return;
          event.preventDefault();
          event.stopPropagation();
          onCommit(clamp(nextGainDb));
        }}
      >
        <span className="pointer-events-none absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 rounded-full bg-white/[0.14]" />
        <span
          className="pointer-events-none absolute inset-x-[3px] h-px bg-white/30"
          style={{ top: center }}
        />
        <span
          className="pointer-events-none absolute left-1/2 w-0.5 -translate-x-1/2 bg-primary"
          style={{ top: Math.min(thumbTop, center), height: Math.abs(thumbTop - center) }}
        />
        <span
          className="pointer-events-none absolute inset-x-[3px] -translate-y-1/2 rounded-[3px] bg-white shadow-[0_2px_6px_rgba(0,0,0,0.5)] transition-transform group-active:scale-110"
          style={{ top: thumbTop, height: sliderThumbHeight }}
        />
      </div>
      <span className="font-mono text-[10px] leading-none text-[var(--text-tertiary)]">
        {label}
      </span>
    </div>
  );
}
