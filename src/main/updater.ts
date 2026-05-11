import electronUpdater from "electron-updater";
import type { AppUpdateState } from "../shared/library";
import { electron } from "./electron";

const { app, BrowserWindow, dialog, ipcMain } = electron;
const { autoUpdater } = electronUpdater;

let updateState: AppUpdateState = { status: "idle" };
let didStartUpdateCheck = false;

function setUpdateState(nextState: AppUpdateState): void {
  updateState = nextState;
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send("app-updates:state-changed", updateState);
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "Update check failed.";
}

export async function checkForAppUpdates(): Promise<AppUpdateState> {
  if (!app.isPackaged) {
    setUpdateState({ status: "idle" });
    return updateState;
  }

  if (updateState.status === "checking" || updateState.status === "downloading") {
    return updateState;
  }

  try {
    setUpdateState({ status: "checking" });
    const result = await autoUpdater.checkForUpdates();
    if (!result) setUpdateState({ status: "idle" });
  } catch (error) {
    setUpdateState({ status: "error", message: getErrorMessage(error) });
  }

  return updateState;
}

export async function checkForAppUpdatesFromMenu(): Promise<void> {
  const state = await checkForAppUpdates();
  const focusedWindow = BrowserWindow.getFocusedWindow();
  const showUpdateMessage = (options: Electron.MessageBoxOptions) =>
    focusedWindow ? dialog.showMessageBox(focusedWindow, options) : dialog.showMessageBox(options);

  if (!app.isPackaged) {
    await showUpdateMessage({
      type: "info",
      message: "Updates are only available in packaged builds.",
    });
    return;
  }

  if (state.status === "idle") {
    await showUpdateMessage({
      type: "info",
      message: "Playhead is up to date.",
    });
    return;
  }

  if (state.status === "error") {
    await showUpdateMessage({
      type: "error",
      message: "Unable to check for updates.",
      detail: state.message,
    });
  }
}

export function registerUpdaterIpc(): void {
  ipcMain.handle("app-updates:get-state", () => updateState);
  ipcMain.handle("app-updates:check", () => checkForAppUpdates());
  ipcMain.handle("app-updates:install", () => {
    if (updateState.status !== "ready") return false;
    autoUpdater.quitAndInstall(false, true);
    return true;
  });
}

export function startUpdater(): void {
  if (didStartUpdateCheck) return;
  didStartUpdateCheck = true;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on("update-available", (info) => {
    setUpdateState({ status: "downloading", version: info.version });
  });

  autoUpdater.on("update-not-available", () => {
    setUpdateState({ status: "idle" });
  });

  autoUpdater.on("download-progress", (progress) => {
    setUpdateState({
      status: "downloading",
      progress: Math.round(progress.percent),
      version: updateState.version,
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    setUpdateState({ status: "ready", version: info.version });
  });

  autoUpdater.on("error", (error) => {
    setUpdateState({ status: "error", message: getErrorMessage(error) });
  });

  void checkForAppUpdates();
}
