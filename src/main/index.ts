import { join } from "node:path";
import { electron } from "./electron";
import { closeFolderWatcher } from "./library/folder-watcher";
import { registerLastfmIpc } from "./lastfm/lastfm";
import { registerLibraryIpc } from "./library/library-ipc";
import { registerMediaShortcuts } from "./media/media-shortcuts";
import { installApplicationMenu } from "./menu";
import { completeSoundCloudAuth, registerSoundCloudIpc } from "./soundcloud/soundcloud";
import { registerTelemetryIpc, trackAppLaunch } from "./telemetry";
import { registerUpdaterIpc, startUpdater } from "./updater";
import { createWindow } from "./window/create-window";
import { registerWindowControlsIpc } from "./window/window-controls";

const { app, BrowserWindow, globalShortcut, ipcMain, nativeImage, protocol } = electron;

function sendSoundCloudStateChanged(state: Awaited<ReturnType<typeof completeSoundCloudAuth>>): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send("soundcloud:state-changed", state);
  }
}

function handleSoundCloudCallback(url: string): void {
  let callbackUrl: URL;
  try {
    callbackUrl = new URL(url);
  } catch {
    return;
  }
  if (callbackUrl.protocol !== "playhead:" || callbackUrl.hostname !== "soundcloud") return;
  const code = callbackUrl.searchParams.get("code");
  if (!code) return;
  void completeSoundCloudAuth(code, callbackUrl.searchParams.get("state") || undefined).then(
    sendSoundCloudStateChanged,
  );
}

if (process.platform === "darwin") {
  app.commandLine.appendSwitch("use-mock-keychain");
}

if (process.platform === "win32") {
  app.setAppUserModelId("com.playhead.app");
}

if (process.defaultApp && process.argv.length >= 2) {
  app.setAsDefaultProtocolClient("playhead", process.execPath, [process.argv[1]]);
} else {
  app.setAsDefaultProtocolClient("playhead");
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) app.quit();

app.on("second-instance", (_event, argv) => {
  const url = argv.find((value) => value.startsWith("playhead://"));
  if (url) handleSoundCloudCallback(url);
  const window = BrowserWindow.getAllWindows()[0];
  if (!window) return;
  if (window.isMinimized()) window.restore();
  window.focus();
});

app.on("open-url", (event, url) => {
  event.preventDefault();
  handleSoundCloudCallback(url);
});

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
  {
    scheme: "playhead-soundcloud-image",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
  {
    scheme: "playhead-soundcloud-audio",
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
