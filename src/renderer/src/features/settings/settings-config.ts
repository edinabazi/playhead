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

/**
 * Confirmation dialog copy per advanced action, stored as translation keys so the
 * dialog can render it in the active language.
 */
export const advancedConfirmationCopy: Record<
  AdvancedSettingsAction,
  { titleKey: string; descriptionKey: string; actionLabelKey: string }
> = {
  "open-data-folder": {
    titleKey: "settings.advanced.openDataFolder.title",
    descriptionKey: "settings.advanced.openDataFolder.description",
    actionLabelKey: "settings.advanced.action.openFolder",
  },
  "clear-waveform-cache": {
    titleKey: "settings.advanced.clearWaveformCache.title",
    descriptionKey: "settings.advanced.clearWaveformCache.description",
    actionLabelKey: "settings.advanced.action.clearCache",
  },
  "rebuild-library-index": {
    titleKey: "settings.advanced.rebuildIndex.title",
    descriptionKey: "settings.advanced.rebuildIndex.description",
    actionLabelKey: "settings.advanced.action.rebuildIndex",
  },
  "reset-app-state": {
    titleKey: "settings.advanced.resetState.title",
    descriptionKey: "settings.advanced.resetState.description",
    actionLabelKey: "settings.advanced.action.resetState",
  },
  "export-library-backup": {
    titleKey: "settings.advanced.exportBackup.title",
    descriptionKey: "settings.advanced.exportBackup.description",
    actionLabelKey: "settings.advanced.action.exportBackup",
  },
  "import-library-backup": {
    titleKey: "settings.advanced.importBackup.title",
    descriptionKey: "settings.advanced.importBackup.description",
    actionLabelKey: "settings.advanced.action.importBackup",
  },
};

export const destructiveAdvancedActions = new Set<AdvancedSettingsAction>([
  "clear-waveform-cache",
  "rebuild-library-index",
  "reset-app-state",
  "import-library-backup",
]);

/**
 * Header copy per category, keyed by translation key rather than literal text so
 * the dialog can render it in the active language.
 */
export const settingsHeaderDescriptionKeys: Record<SettingsCategoryId, string> = {
  library: "settings.description.library",
  playback: "settings.description.playback",
  appearance: "settings.description.appearance",
  shortcuts: "settings.description.shortcuts",
  integrations: "settings.description.integrations",
  advanced: "settings.description.advanced",
};
