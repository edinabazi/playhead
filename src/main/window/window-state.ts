import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { electron } from "../electron";

const { app, screen } = electron;
export const minimumWindowSize = { width: 720, height: 560 };

type WindowState = Electron.Rectangle & { maximized: boolean };

export function readWindowState(): WindowState | null {
  try {
    const state = JSON.parse(
      readFileSync(join(app.getPath("userData"), "window-state.json"), "utf8"),
    ) as WindowState;
    if (
      !state ||
      ![state.x, state.y, state.width, state.height].every(Number.isFinite) ||
      state.width < minimumWindowSize.width ||
      state.height < minimumWindowSize.height
    )
      return null;

    const display =
      screen
        .getAllDisplays()
        .find(
          ({ workArea }) =>
            state.x < workArea.x + workArea.width &&
            state.x + state.width > workArea.x &&
            state.y < workArea.y + workArea.height &&
            state.y + state.height > workArea.y,
        ) || screen.getPrimaryDisplay();
    const area = display.workArea;
    const width = Math.max(minimumWindowSize.width, Math.min(Math.round(state.width), area.width));
    const height = Math.max(
      minimumWindowSize.height,
      Math.min(Math.round(state.height), area.height),
    );
    return {
      width,
      height,
      x: Math.max(area.x, Math.min(Math.round(state.x), area.x + Math.max(0, area.width - width))),
      y: Math.max(
        area.y,
        Math.min(Math.round(state.y), area.y + Math.max(0, area.height - height)),
      ),
      maximized: state.maximized === true,
    };
  } catch {
    return null;
  }
}

export function saveWindowState(window: Electron.BrowserWindow): void {
  if (window.isDestroyed()) return;
  try {
    const state: WindowState = { ...window.getNormalBounds(), maximized: window.isMaximized() };
    writeFileSync(join(app.getPath("userData"), "window-state.json"), JSON.stringify(state));
  } catch (error) {
    console.warn("Could not save window size", error);
  }
}
