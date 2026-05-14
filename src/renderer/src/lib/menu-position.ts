export type MenuAnchorPoint = {
  x: number;
  y: number;
  align?: "left" | "right";
};

export function getNativeFileManagerName(): string {
  if (navigator.platform.toLowerCase().includes("win")) return "Explorer";
  return "Finder";
}

export function shouldOpenSubmenuLeft(element: HTMLElement | null, submenuWidth = 208): boolean {
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  return rect.right + submenuWidth + 8 > window.innerWidth && rect.left > submenuWidth + 8;
}

export function getMenuPointFromElement(element: HTMLElement | null): MenuAnchorPoint | null {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return { x: rect.right, y: rect.bottom + 8, align: "right" };
}

export function clampMenuPoint(point: MenuAnchorPoint, width = 224, height = 176) {
  const margin = 8;
  const preferredX = point.align === "right" ? point.x - width : point.x;
  const fitsRight = preferredX + width + margin <= window.innerWidth;
  const flippedX = point.x - width;
  const x = point.align === "right" || fitsRight ? preferredX : flippedX;
  const fitsBelow = point.y + height + margin <= window.innerHeight;
  const fitsAbove = point.y - height - margin >= 0;
  const y = !fitsBelow && fitsAbove ? point.y - height : point.y;

  return {
    x: Math.max(margin, Math.min(x, window.innerWidth - width - margin)),
    y: Math.max(margin, Math.min(y, window.innerHeight - height - margin)),
  };
}
