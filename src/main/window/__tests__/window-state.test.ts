// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  directory: "",
  displays: [{ workArea: { x: 0, y: 0, width: 1440, height: 900 } }],
}));
vi.mock("../../electron", () => ({
  electron: {
    app: { getPath: () => mocks.directory },
    screen: { getAllDisplays: () => mocks.displays, getPrimaryDisplay: () => mocks.displays[0] },
  },
}));
import { readWindowState, saveWindowState } from "../window-state";

beforeEach(() => {
  mocks.directory = mkdtempSync(join(tmpdir(), "playhead-window-test-"));
});
afterEach(() => {
  rmSync(mocks.directory, { recursive: true, force: true });
});

it("saves normal bounds while maximized and restores them on the next launch", () => {
  const bounds = { x: 80, y: 40, width: 1000, height: 700 };
  saveWindowState({
    isDestroyed: () => false,
    getNormalBounds: () => bounds,
    isMaximized: () => true,
  } as Electron.BrowserWindow);
  expect(readWindowState()).toEqual({ ...bounds, maximized: true });
  expect(JSON.parse(readFileSync(join(mocks.directory, "window-state.json"), "utf8"))).toEqual({
    ...bounds,
    maximized: true,
  });
});

it("moves a saved window from a disconnected display into the current work area", () => {
  writeFileSync(
    join(mocks.directory, "window-state.json"),
    JSON.stringify({ x: -2000, y: 2000, width: 2000, height: 1500, maximized: false }),
  );
  expect(readWindowState()).toEqual({ x: 0, y: 0, width: 1440, height: 900, maximized: false });
});

it.each([
  "{broken",
  "null",
  '{"x":0,"y":0,"width":10,"height":700}',
  '{"x":0,"width":900,"height":700}',
])("falls back to defaults for invalid window state: %s", (content) => {
  writeFileSync(join(mocks.directory, "window-state.json"), content);
  expect(readWindowState()).toBeNull();
});
