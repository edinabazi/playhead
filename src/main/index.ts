import { join } from "node:path";
import { electron } from "./electron";
import { closeFolderWatcher } from "./library/folder-watcher";
import { registerLibraryIpc } from "./library/library-ipc";
import { registerMediaShortcuts } from "./media/media-shortcuts";
import { registerTelemetryIpc, trackAppLaunch } from "./telemetry";
import { registerUpdaterIpc, startUpdater } from "./updater";
import { createWindow } from "./window/create-window";
import { registerWindowControlsIpc } from "./window/window-controls";

const { app, BrowserWindow, Menu, globalShortcut, nativeImage, protocol } = electron;

if (process.platform === "darwin") {
  app.commandLine.appendSwitch("use-mock-keychain");
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: "playhead-media",
    privileges: {
      standard: true,
      secure: true,
      stream: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

app.whenReady().then(() => {
  app.setName("Playhead");
  if (process.platform !== "darwin") {
    Menu.setApplicationMenu(null);
  }

  if (process.platform === "darwin") {
    app.dock?.setIcon(
      nativeImage.createFromPath(join(__dirname, "../../resources/playhead-icon.png")),
    );
  }

  registerLibraryIpc();
  registerTelemetryIpc();
  registerMediaShortcuts();
  registerUpdaterIpc();
  registerWindowControlsIpc();
  createWindow();
  startUpdater();
  void trackAppLaunch();

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
