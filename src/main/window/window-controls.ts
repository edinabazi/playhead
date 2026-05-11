import { electron } from "../electron";

const { BrowserWindow, ipcMain, screen } = electron;

const manuallyMaximizedBounds = new WeakMap<Electron.BrowserWindow, Electron.Rectangle>();

function getSenderWindow(event: Electron.IpcMainInvokeEvent): Electron.BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender);
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

  ipcMain.handle("window:toggle-maximize", (event) => {
    const win = getSenderWindow(event);
    if (!win) return;

    const restoreBounds = manuallyMaximizedBounds.get(win);
    if (restoreBounds) {
      manuallyMaximizedBounds.delete(win);
      win.setBounds(restoreBounds, false);
      return;
    }

    if (win.isMaximized()) {
      win.unmaximize();
      return;
    }

    const normalBounds = win.getBounds();
    win.maximize();

    if (!win.isMaximized()) {
      manuallyMaximizedBounds.set(win, normalBounds);
      win.setBounds(screen.getDisplayMatching(normalBounds).workArea, false);
    }
  });

  ipcMain.handle("window:close", (event) => {
    getSenderWindow(event)?.close();
  });
}
