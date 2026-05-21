import { join } from "node:path";
import { electron } from "./electron";
import { closeFolderWatcher } from "./library/folder-watcher";
import { registerLastfmIpc } from "./lastfm/lastfm";
import { registerLibraryIpc } from "./library/library-ipc";
import { registerMediaShortcuts } from "./media/media-shortcuts";
import { installApplicationMenu } from "./menu";
import { registerSoundCloudIpc } from "./soundcloud/soundcloud";
import { registerTelemetryIpc, trackAppLaunch } from "./telemetry";
import { registerUpdaterIpc, startUpdater } from "./updater";
import { createWindow } from "./window/create-window";
import { registerWindowControlsIpc } from "./window/window-controls";

const { app, BrowserWindow, globalShortcut, ipcMain, nativeImage, protocol } = electron;

if (process.platform === "darwin") {
  app.commandLine.appendSwitch("use-mock-keychain");
}

if (process.platform === "win32") {
  app.setAppUserModelId("com.playhead.app");
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
  {
    scheme: "playhead-artwork",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

app.whenReady().then(() => {
  app.setName("Playhead");
  installApplicationMenu();

  if (process.platform === "darwin") {
    app.dock?.setIcon(
      nativeImage.createFromPath(join(__dirname, "../../resources/playhead-icon.png")),
    );
  }

  registerLibraryIpc();
  registerLastfmIpc();
  registerSoundCloudIpc();
  registerTelemetryIpc();
  registerMediaShortcuts();
  registerUpdaterIpc();
  registerWindowControlsIpc();
  ipcMain.handle("app:get-version", () => app.getVersion());
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
