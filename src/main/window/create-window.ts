import { join } from "node:path";
import electron from "electron";

const { BrowserWindow } = electron;

export function createWindow(): void {
  const iconPath = join(__dirname, "../../resources/playhead-icon.png");

  const win = new BrowserWindow({
    width: 980,
    height: 980,
    minWidth: 720,
    minHeight: 560,
    title: "Playhead",
    icon: iconPath,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 35, y: 38 },
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
}
