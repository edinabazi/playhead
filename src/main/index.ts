import { join } from "node:path";
import { electron } from "./electron";
import { closeFolderWatcher } from "./library/folder-watcher";
import { registerLibraryIpc } from "./library/library-ipc";
import { registerMediaShortcuts } from "./media/media-shortcuts";
import { registerTelemetryIpc, trackAppLaunch } from "./telemetry";
import { createWindow } from "./window/create-window";

const { app, BrowserWindow, globalShortcut, nativeImage, protocol } = electron;

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
  if (process.platform === "darwin") {
    app.dock?.setIcon(
      nativeImage.createFromPath(join(__dirname, "../../resources/playhead-icon.png")),
    );
  }

  registerLibraryIpc();
  registerTelemetryIpc();
  registerMediaShortcuts();
  createWindow();
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
