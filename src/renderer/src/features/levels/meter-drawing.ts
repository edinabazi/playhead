import { meterRangeDb } from "./meter-model";

export const ledMeterHeight = 58;

const maxPanelWidth = 960;
const labelColumnWidth = 22;
const rightPadding = 12;
const segmentHeight = 9;
const rowGap = 10;
const segmentGap = 2;
const glowRadius = 6;
const unlitAlpha = 0.12;
const channelLabels = ["L", "R"];
const labelColor = "#8a8884";
const font = "600 11px ui-monospace, SFMono-Regular, Menlo, monospace";

export type LedMeterFrame = {
  litSegments: [number, number];
  holdSegments: [number | null, number | null];
};

export type LedMeterLayout = {
  width: number;
  panelX: number;
  panelWidth: number;
  barX: number;
  barWidth: number;
  segmentCount: number;
  segmentWidth: number;
  rowTops: [number, number];
  scaleDb: number[];
};

export type LedMeterCache = {
  key: string;
  layout: LedMeterLayout;
  ratio: number;
  base: HTMLCanvasElement;
  lit: HTMLCanvasElement;
};

export function getLedMeterLayout(width: number): LedMeterLayout {
  const panelWidth = Math.min(width, maxPanelWidth);
  const barWidth = panelWidth - labelColumnWidth - rightPadding;
  const segmentCount = Math.max(24, Math.min(60, Math.round(barWidth / 9 / 2) * 2));
  return {
    width,
    panelX: (width - panelWidth) / 2,
    panelWidth,
    barX: (width - panelWidth) / 2 + labelColumnWidth,
    barWidth,
    segmentCount,
    segmentWidth: (barWidth - segmentGap * (segmentCount - 1)) / segmentCount,
    rowTops: [ledMeterHeight / 2 - segmentHeight - rowGap, ledMeterHeight / 2 + rowGap],
    scaleDb: barWidth >= 360 ? [-40, -30, -20, -10, -6, -3, 0] : [-40, -20, -10, -3, 0],
  };
}

function segmentColor(index: number, segmentCount: number): string {
  const segmentDb = -meterRangeDb + ((index + 1) * meterRangeDb) / segmentCount;
  return segmentDb > -3 ? "#ff3b30" : segmentDb > -9 ? "#ffd60a" : "#34d17a";
}

function segmentX(layout: LedMeterLayout, index: number): number {
  return layout.barX + index * (layout.segmentWidth + segmentGap);
}

function createLayerCanvas(width: number, ratio: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(ledMeterHeight * ratio);
  const context = canvas.getContext("2d");
  context?.scale(ratio, ratio);
  return { canvas, context };
}

function fillRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fill();
}

function drawSegments(context: CanvasRenderingContext2D, layout: LedMeterLayout, lit: boolean) {
  for (const rowTop of layout.rowTops) {
    for (let index = 0; index < layout.segmentCount; index += 1) {
      const color = segmentColor(index, layout.segmentCount);
      context.fillStyle = color;
      context.shadowColor = color;
      context.shadowBlur = lit ? glowRadius : 0;
      context.globalAlpha = lit ? 1 : unlitAlpha;
      fillRoundedRect(
        context,
        segmentX(layout, index),
        rowTop,
        layout.segmentWidth,
        segmentHeight,
        1.5,
      );
    }
  }
  context.shadowBlur = 0;
  context.globalAlpha = 1;
}

// The glow is expensive to blur on every frame, so both states of every segment are painted
// once per size and each frame only copies the lit part over the unlit layer.
export function createLedMeterCache(width: number, ratio: number): LedMeterCache | null {
  const layout = getLedMeterLayout(width);
  const base = createLayerCanvas(width, ratio);
  const lit = createLayerCanvas(width, ratio);
  if (!base.context || !lit.context) return null;

  base.context.fillStyle = "#0a0a09";
  fillRoundedRect(base.context, layout.panelX, 0, layout.panelWidth, ledMeterHeight, 10);
  drawSegments(base.context, layout, false);
  base.context.font = font;
  base.context.fillStyle = labelColor;
  base.context.textBaseline = "middle";
  base.context.textAlign = "left";
  layout.rowTops.forEach((rowTop, channel) =>
    base.context?.fillText(channelLabels[channel], layout.panelX + 8, rowTop + segmentHeight / 2),
  );
  base.context.textAlign = "center";
  for (const db of layout.scaleDb) {
    const x = layout.barX + ((db + meterRangeDb) / meterRangeDb) * layout.barWidth;
    base.context.fillText(String(db), x, ledMeterHeight / 2);
  }

  drawSegments(lit.context, layout, true);
  return { key: `${width}@${ratio}`, layout, ratio, base: base.canvas, lit: lit.canvas };
}

function copyLitRegion(
  context: CanvasRenderingContext2D,
  cache: LedMeterCache,
  rowTop: number,
  fromX: number,
  toX: number,
) {
  const { ratio } = cache;
  const sourceX = Math.max(0, Math.floor(fromX * ratio));
  const sourceY = Math.max(0, Math.floor((rowTop - glowRadius) * ratio));
  const sourceWidth = Math.min(cache.lit.width - sourceX, Math.ceil((toX - fromX) * ratio));
  const sourceHeight = Math.min(
    cache.lit.height - sourceY,
    Math.ceil((segmentHeight + glowRadius * 2) * ratio),
  );
  if (sourceWidth <= 0 || sourceHeight <= 0) return;
  context.drawImage(
    cache.lit,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
  );
}

export function drawLedMeter(
  context: CanvasRenderingContext2D,
  cache: LedMeterCache,
  frame: LedMeterFrame,
) {
  const { layout } = cache;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, context.canvas.width, context.canvas.height);
  context.drawImage(cache.base, 0, 0);

  layout.rowTops.forEach((rowTop, channel) => {
    const litSegments = frame.litSegments[channel];
    if (litSegments > 0) {
      const endX = segmentX(layout, litSegments - 1) + layout.segmentWidth + segmentGap / 2;
      copyLitRegion(context, cache, rowTop, layout.panelX, endX);
    }

    const holdSegment = frame.holdSegments[channel];
    if (holdSegment !== null && holdSegment >= litSegments) {
      const startX = segmentX(layout, holdSegment) - segmentGap / 2;
      copyLitRegion(context, cache, rowTop, startX, startX + layout.segmentWidth + segmentGap);
    }
  });
}
