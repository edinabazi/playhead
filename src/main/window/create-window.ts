import { join } from "node:path";
import { electron } from "../electron";
import { keepPlaybackWindowAlive } from "./background-playback";
import { minimumWindowSize, readWindowState, saveWindowState } from "./window-state";

const { app, BrowserWindow, nativeImage, shell } = electron;

export function getWindowIconPath(): string {
  const iconFile = process.platform === "win32" ? "playhead.ico" : "playhead-icon.png";

  return app.isPackaged
    ? join(process.resourcesPath, iconFile)
    : join(__dirname, "../../resources", iconFile);
}

export function createWindow(isQuitting: () => boolean): Electron.BrowserWindow {
  const iconPath = getWindowIconPath();
  const isMac = process.platform === "darwin";
  const windowIcon = nativeImage.createFromPath(iconPath);
  const savedState = readWindowState();

  const win = new BrowserWindow({
    width: savedState?.width ?? 980,
    height: savedState?.height ?? 980,
    ...(savedState ? { x: savedState.x, y: savedState.y } : {}),
    minWidth: minimumWindowSize.width,
    minHeight: minimumWindowSize.height,
    title: "Playhead",
    icon: windowIcon.isEmpty() ? iconPath : windowIcon,
    frame: isMac,
    titleBarStyle: isMac ? "hiddenInset" : undefined,
    trafficLightPosition: isMac ? { x: 35, y: 38 } : undefined,
    autoHideMenuBar: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    transparent: true,
    webPreferences: {
      preload: join(__dirname, "../preload/index.mjs"),
      backgroundThrottling: false,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  const scheduleSave = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveWindowState(win), 250);
  };
  win.on("resize", scheduleSave);
  win.on("move", scheduleSave);
  win.on("maximize", scheduleSave);
  win.on("unmaximize", scheduleSave);
  win.on("closed", () => clearTimeout(saveTimer));
  win.on("close", (event) => {
    clearTimeout(saveTimer);
    saveWindowState(win);
    keepPlaybackWindowAlive(event, win, isQuitting());
  });
  if (savedState?.maximized) win.maximize();

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    win.loadFile(join(__dirname, "../renderer/index.html"));
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      void shell.openExternal(url);
    }

    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (event, url) => {
    const currentUrl = win.webContents.getURL();
    if (url === currentUrl || url.startsWith("file://") || url.startsWith("http://localhost:")) {
      return;
    }

    event.preventDefault();

    if (url.startsWith("http://") || url.startsWith("https://")) {
      void shell.openExternal(url);
    }
  });

  return win;
}
