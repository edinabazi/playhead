import { electron } from "../electron";

const { BrowserWindow, ipcMain, screen } = electron;

const manuallyMaximizedBounds = new WeakMap<Electron.BrowserWindow, Electron.Rectangle>();

function getSenderWindow(event: Electron.IpcMainInvokeEvent): Electron.BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender);
}

/**
 * Whether the window is currently restored-out, including the manual maximize
 * fallback used where `win.maximize()` does not report a maximized state.
 */
function isWindowMaximized(win: Electron.BrowserWindow): boolean {
  return win.isMaximized() || manuallyMaximizedBounds.has(win);
}

function notifyMaximizedChanged(win: Electron.BrowserWindow): void {
  if (win.isDestroyed()) return;
  win.webContents.send("window:maximized-changed", isWindowMaximized(win));
}

export function registerWindowControlsIpc(): void {
  ipcMain.handle("window:move-to", (event, x: number, y: number) => {
    const win = getSenderWindow(event);
    if (!win) return;

    win.setPosition(Math.round(x), Math.round(y), false);
  });

  ipcMain.handle("window:minimize", (event) => {
    getSenderWindow(event)?.minimize();
  });

  ipcMain.handle("window:is-maximized", (event) => {
    const win = getSenderWindow(event);
    return win ? isWindowMaximized(win) : false;
  });

  ipcMain.handle("window:toggle-maximize", (event) => {
    const win = getSenderWindow(event);
    if (!win) return;

    const restoreBounds = manuallyMaximizedBounds.get(win);
    if (restoreBounds) {
      manuallyMaximizedBounds.delete(win);
      win.setBounds(restoreBounds, false);
      notifyMaximizedChanged(win);
      return;
    }

    if (win.isMaximized()) {
      win.unmaximize();
      notifyMaximizedChanged(win);
      return;
    }

    const normalBounds = win.getBounds();
    win.maximize();

    if (!win.isMaximized()) {
      manuallyMaximizedBounds.set(win, normalBounds);
      win.setBounds(screen.getDisplayMatching(normalBounds).workArea, false);
    }

    notifyMaximizedChanged(win);
  });

  ipcMain.handle("window:close", (event) => {
    getSenderWindow(event)?.close();
  });
}

/**
 * Keeps the maximize/restore glyph in sync when the window is maximized by
 * means other than the custom control: double-clicking the drag region, a
 * system shortcut, or dragging the window to the top edge.
 */
export function watchWindowMaximizedState(win: Electron.BrowserWindow): void {
  const notify = () => notifyMaximizedChanged(win);
  win.on("maximize", notify);
  win.on("unmaximize", notify);
  win.on("enter-full-screen", notify);
  win.on("leave-full-screen", notify);
}
