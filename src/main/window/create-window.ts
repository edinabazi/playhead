import { join } from "node:path";
import { electron } from "../electron";

const { app, BrowserWindow, shell } = electron;

export function createWindow(): void {
  const iconPath = app.isPackaged
    ? join(process.resourcesPath, "playhead-icon.png")
    : join(__dirname, "../../resources/playhead-icon.png");
  const isMac = process.platform === "darwin";

  const win = new BrowserWindow({
    width: 980,
    height: 980,
    minWidth: 720,
    minHeight: 560,
    title: "Playhead",
    icon: iconPath,
    frame: isMac,
    titleBarStyle: isMac ? "hiddenInset" : undefined,
    trafficLightPosition: isMac ? { x: 35, y: 38 } : undefined,
    autoHideMenuBar: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    transparent: true,
    webPreferences: {
      preload: join(__dirname, "../preload/index.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

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
}
