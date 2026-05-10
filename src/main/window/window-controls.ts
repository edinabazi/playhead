import { electron } from "../electron";

const { BrowserWindow, ipcMain } = electron;

function getSenderWindow(event: Electron.IpcMainInvokeEvent): Electron.BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender);
}

export function registerWindowControlsIpc(): void {
  ipcMain.handle("window:minimize", (event) => {
    getSenderWindow(event)?.minimize();
  });

  ipcMain.handle("window:toggle-maximize", (event) => {
    const win = getSenderWindow(event);
    if (!win) return;

    if (win.isMaximized()) {
      win.unmaximize();
      return;
    }

    win.maximize();
  });

  ipcMain.handle("window:close", (event) => {
    getSenderWindow(event)?.close();
  });
}
