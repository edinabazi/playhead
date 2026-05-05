import { app, BrowserWindow, globalShortcut, nativeImage } from "electron";
import { join } from "node:path";
import { closeFolderWatcher } from "./library/folder-watcher";
import { registerLibraryIpc } from "./library/library-ipc";
import { registerMediaShortcuts } from "./media/media-shortcuts";
import { createWindow } from "./window/create-window";

app.whenReady().then(() => {
  app.setName("Playhead");
  if (process.platform === "darwin") {
    app.dock?.setIcon(
      nativeImage.createFromPath(join(__dirname, "../../resources/playhead-icon.png")),
    );
  }

  registerLibraryIpc();
  registerMediaShortcuts();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  void closeFolderWatcher();
});
