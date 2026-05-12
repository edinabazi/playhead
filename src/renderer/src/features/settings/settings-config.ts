import type { AdvancedSettingsAction } from "./SettingsDialog";

export type SettingsCategoryId =
  | "library"
  | "playback"
  | "appearance"
  | "shortcuts"
  | "integrations"
  | "advanced";

export const fileFormatOptions = [
  { extension: ".mp3", label: "MP3" },
  { extension: ".flac", label: "FLAC" },
  { extension: ".wav", label: "WAV" },
  { extension: ".aiff", label: "AIFF" },
  { extension: ".aif", label: "AIF" },
  { extension: ".m4a", label: "M4A" },
  { extension: ".ogg", label: "OGG" },
  { extension: ".opus", label: "OPUS" },
  { extension: ".aac", label: "AAC" },
];

export const advancedConfirmationCopy: Record<
  AdvancedSettingsAction,
  { title: string; description: string; actionLabel: string }
> = {
  "open-data-folder": {
    title: "Open data folder?",
    description: "This opens Playhead's app data folder.",
    actionLabel: "Open Folder",
  },
  "clear-waveform-cache": {
    title: "Clear waveform cache?",
    description: "Playhead will remove generated waveform files and rebuild them when needed.",
    actionLabel: "Clear Cache",
  },
  "rebuild-library-index": {
    title: "Rebuild library index?",
    description: "Playhead will rescan every folder and remove tracks that no longer exist.",
    actionLabel: "Rebuild Index",
  },
  "reset-app-state": {
    title: "Reset app state?",
    description: "This clears saved playback position and last session. Your library stays here.",
    actionLabel: "Reset State",
  },
  "export-library-backup": {
    title: "Export library backup?",
    description: "This saves a JSON backup of your library and settings.",
    actionLabel: "Export Backup",
  },
  "import-library-backup": {
    title: "Import library backup?",
    description: "This replaces your current library and settings with the selected backup.",
    actionLabel: "Import Backup",
  },
};

export const destructiveAdvancedActions = new Set<AdvancedSettingsAction>([
  "clear-waveform-cache",
  "rebuild-library-index",
  "reset-app-state",
  "import-library-backup",
]);

export const settingsHeaderDescriptions: Record<SettingsCategoryId, string> = {
  library: "Folder scanning and file visibility.",
  playback: "Keyboard playback behavior.",
  appearance: "Window transparency and motion.",
  shortcuts: "Current keyboard controls.",
  integrations: "Connected music services.",
  advanced: "Maintenance, backup, and diagnostics.",
};
