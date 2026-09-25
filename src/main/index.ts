import { registerLyricsIpc } from "./lyrics/lyrics-ipc";
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
import { revealPlaybackWindow } from "./window/background-playback";
import { createWindow, getWindowIconPath } from "./window/create-window";
import { registerWindowControlsIpc } from "./window/window-controls";

const { app, BrowserWindow, globalShortcut, ipcMain, Menu, nativeImage, protocol, Tray } = electron;

let isQuitting = false;
let tray: Electron.Tray | null = null;

function createMainWindow(): Electron.BrowserWindow {
  return createWindow(() => isQuitting);
}

function revealOrCreateMainWindow(): void {
  const window = BrowserWindow.getAllWindows()[0];
  if (window) {
    revealPlaybackWindow(window);
    return;
  }

  createMainWindow();
}

function installBackgroundPlaybackTray(): void {
  if (process.platform === "darwin" || tray) return;

  const trayIcon = nativeImage
    .createFromPath(getWindowIconPath())
    .resize({ width: 18, height: 18 });
  tray = new Tray(trayIcon);
  tray.setToolTip("Playhead");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Open Playhead", click: revealOrCreateMainWindow },
      { type: "separator" },
      { label: "Quit Playhead", click: () => app.quit() },
    ]),
  );
  tray.on("click", revealOrCreateMainWindow);
}

function sendSoundCloudStateChanged(
  state: Awaited<ReturnType<typeof completeSoundCloudAuth>>,
): void {
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
  revealPlaybackWindow(window);
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
  registerLyricsIpc();
  registerLastfmIpc();
  registerSoundCloudIpc();
  registerTelemetryIpc();
  registerMediaShortcuts();
  registerUpdaterIpc();
  registerWindowControlsIpc();
  ipcMain.handle("app:get-version", () => app.getVersion());
  createMainWindow();
  installBackgroundPlaybackTray();
  startUpdater();
  void trackAppLaunch();

  app.on("activate", () => {
    revealOrCreateMainWindow();
  });
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", () => {
  tray?.destroy();
  tray = null;
  globalShortcut.unregisterAll();
  void closeFolderWatcher();
});
