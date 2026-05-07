import electron from "electron";
import type { MediaCommand } from "../../shared/library";

const { BrowserWindow, globalShortcut } = electron;

function sendMediaCommand(command: MediaCommand): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send("media-command", command);
  }
}

export function registerMediaShortcuts(): void {
  globalShortcut.register("MediaPlayPause", () => sendMediaCommand("play-pause"));
  globalShortcut.register("MediaNextTrack", () => sendMediaCommand("next"));
  globalShortcut.register("MediaPreviousTrack", () => sendMediaCommand("previous"));
}
