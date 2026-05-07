import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  defaultAppearanceSettings,
  defaultLibrarySettings,
  defaultPlaybackSettings,
  type AppearanceSettings,
  type LibraryFolder,
  type LibrarySettings,
  type PlaybackSettings,
} from "../../../../shared/library";
import {
  DialogOverlay,
  DialogPanel,
  dialogOverlayMotion,
  dialogPanelMotion,
} from "@/components/ui/dialog-motion";
import { useIcons } from "@/lib/icon-context";
import { getPrimaryModifierLabel } from "@/lib/platform";

type SettingsCategoryId = "library" | "playback" | "appearance" | "shortcuts" | "advanced";

export type AdvancedSettingsAction =
  | "open-data-folder"
  | "clear-waveform-cache"
  | "rebuild-library-index"
  | "reset-app-state"
  | "export-library-backup"
  | "import-library-backup";

const fileFormatOptions = [
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

export function SettingsDialog({
  librarySettings,
  libraryFolders,
  isScanning,
  onAddLibraryFolder,
  onLibrarySettingsChange,
  onRemoveLibraryFolder,
  playbackSettings,
  onPlaybackSettingsChange,
  appearanceSettings,
  onAppearanceSettingsChange,
  onAppearancePreviewChange,
  onAdvancedAction,
  onClose,
}: {
  librarySettings: LibrarySettings;
  libraryFolders: LibraryFolder[];
  isScanning: boolean;
  onAddLibraryFolder: () => void;
  onLibrarySettingsChange: (settings: LibrarySettings) => void;
  onRemoveLibraryFolder: (folder: LibraryFolder) => void;
  playbackSettings: PlaybackSettings;
  onPlaybackSettingsChange: (settings: PlaybackSettings) => void;
  appearanceSettings: AppearanceSettings;
  onAppearanceSettingsChange: (settings: AppearanceSettings) => void;
  onAppearancePreviewChange: (appTransparency: number | null) => void;
  onAdvancedAction: (action: AdvancedSettingsAction) => Promise<string>;
  onClose: () => void;
}) {
  const icons = useIcons();
  const FolderOpenIcon = icons["folder-open"];
  const FolderPlusIcon = icons["folder-plus"];
  const CheckIcon = icons.check;
  const ChevronRightIcon = icons["chevron-right"];
  const [activeCategory, setActiveCategory] = useState<SettingsCategoryId>("library");
  const [draftLibrarySettings, setDraftLibrarySettings] = useState<LibrarySettings>(() => ({
    ...defaultLibrarySettings(),
    ...librarySettings,
  }));
  const [draftPlaybackSettings, setDraftPlaybackSettings] = useState<PlaybackSettings>(() => ({
    ...defaultPlaybackSettings(),
    ...playbackSettings,
  }));
  const [draftAppearanceSettings, setDraftAppearanceSettings] = useState<AppearanceSettings>(
    () => ({
      ...defaultAppearanceSettings(),
      ...appearanceSettings,
    }),
  );
  const [isTransparencyPreviewing, setIsTransparencyPreviewing] = useState(false);
  const [pendingAdvancedAction, setPendingAdvancedAction] = useState<AdvancedSettingsAction | null>(
    null,
  );
  const [advancedActionPendingConfirmation, setAdvancedActionPendingConfirmation] =
    useState<AdvancedSettingsAction | null>(null);
  const modifierLabel = getPrimaryModifierLabel();
  const savedSettings = { ...defaultLibrarySettings(), ...librarySettings };
  const savedPlaybackSettings = { ...defaultPlaybackSettings(), ...playbackSettings };
  const savedAppearanceSettings = { ...defaultAppearanceSettings(), ...appearanceSettings };
  const settingsChanged =
    savedSettings.mode !== draftLibrarySettings.mode ||
    savedSettings.watchFolders !== draftLibrarySettings.watchFolders ||
    savedSettings.rescanOnLaunch !== draftLibrarySettings.rescanOnLaunch ||
    savedSettings.enabledAudioExtensions.join("|") !==
      draftLibrarySettings.enabledAudioExtensions.join("|");
  const playbackSettingsChanged =
    savedPlaybackSettings.seekStepSeconds !== draftPlaybackSettings.seekStepSeconds ||
    savedPlaybackSettings.volumeStepPercent !== draftPlaybackSettings.volumeStepPercent ||
    savedPlaybackSettings.rememberTrackPositions !== draftPlaybackSettings.rememberTrackPositions ||
    savedPlaybackSettings.restoreLastSession !== draftPlaybackSettings.restoreLastSession ||
    savedPlaybackSettings.skipUnavailableTracks !== draftPlaybackSettings.skipUnavailableTracks;
  const appearanceSettingsChanged =
    savedAppearanceSettings.appTransparency !== draftAppearanceSettings.appTransparency ||
    savedAppearanceSettings.reduceMotion !== draftAppearanceSettings.reduceMotion;
  const hasUnsavedChanges = settingsChanged || playbackSettingsChanged || appearanceSettingsChanged;
  const categories = [
    { id: "library", label: "Library", icon: FolderOpenIcon },
    { id: "playback", label: "Playback", icon: icons.play },
    { id: "appearance", label: "Appearance", icon: icons.palette },
    { id: "shortcuts", label: "Shortcuts", icon: icons.keyboard },
    { id: "advanced", label: "Advanced", icon: icons.settings },
  ] satisfies Array<{
    id: SettingsCategoryId;
    label: string;
    icon: typeof FolderOpenIcon;
  }>;
  const activeCategoryMeta =
    categories.find((category) => category.id === activeCategory) || categories[0];
  const shiftSeekStep = savedPlaybackSettings.seekStepSeconds * 2;
  const shiftVolumeStep = savedPlaybackSettings.volumeStepPercent * 2;
  const shortcuts = [
    { action: "Play or pause", keys: ["Space"] },
    {
      action: "Search tracks",
      keys: [`${modifierLabel} K`],
      secondaryKeys: [`${modifierLabel} F`],
    },
    { action: "Open settings", keys: [`${modifierLabel} ,`] },
    {
      action: "Seek backward",
      keys: ["←"],
      detail: `${savedPlaybackSettings.seekStepSeconds} seconds. Hold Shift for ${shiftSeekStep} seconds.`,
    },
    {
      action: "Seek forward",
      keys: ["→"],
      detail: `${savedPlaybackSettings.seekStepSeconds} seconds. Hold Shift for ${shiftSeekStep} seconds.`,
    },
    { action: "Select previous track", keys: ["↑"] },
    { action: "Select next track", keys: ["↓"] },
    { action: "Play selected track", keys: ["Enter"] },
    { action: "Love selected track", keys: ["L"] },
    {
      action: "Volume up",
      keys: [`${modifierLabel} ↑`],
      detail: `${savedPlaybackSettings.volumeStepPercent}%. Hold Shift for ${shiftVolumeStep}%.`,
    },
    {
      action: "Volume down",
      keys: [`${modifierLabel} ↓`],
      detail: `${savedPlaybackSettings.volumeStepPercent}%. Hold Shift for ${shiftVolumeStep}%.`,
    },
  ];
  const advancedActions = [
    {
      id: "open-data-folder",
      title: "Open data folder",
      description: "Open Playhead's app data folder.",
      icon: icons["folder-open"],
    },
    {
      id: "clear-waveform-cache",
      title: "Clear waveform cache",
      description: "Remove generated waveform files so they can be rebuilt.",
      icon: icons["audio-waveform"],
    },
    {
      id: "rebuild-library-index",
      title: "Rebuild library index",
      description: "Rescan every folder and remove tracks that no longer exist.",
      icon: icons["rotate-ccw"],
    },
    {
      id: "reset-app-state",
      title: "Reset app state",
      description: "Clear saved playback/session state without removing your library.",
      icon: icons["trash-2"],
    },
    {
      id: "export-library-backup",
      title: "Export library backup",
      description: "Save a JSON backup of your library and settings.",
      icon: icons["folder-open"],
    },
    {
      id: "import-library-backup",
      title: "Import library backup",
      description: "Restore a previously exported Playhead backup.",
      icon: icons["folder-plus"],
    },
  ] satisfies Array<{
    id: AdvancedSettingsAction;
    title: string;
    description: string;
    icon: typeof FolderOpenIcon;
  }>;
  const destructiveAdvancedActions = new Set<AdvancedSettingsAction>([
    "clear-waveform-cache",
    "rebuild-library-index",
    "reset-app-state",
    "import-library-backup",
  ]);
  const advancedConfirmationCopy: Record<
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

  const toggleExtension = (extension: string) => {
    const enabled = new Set(draftLibrarySettings.enabledAudioExtensions);
    if (enabled.has(extension)) enabled.delete(extension);
    else enabled.add(extension);

    if (enabled.size === 0) return;

    setDraftLibrarySettings({
      ...draftLibrarySettings,
      enabledAudioExtensions: fileFormatOptions
        .map((option) => option.extension)
        .filter((optionExtension) => enabled.has(optionExtension)),
    });
  };

  const resetLibrarySettings = () => {
    setDraftLibrarySettings(savedSettings);
  };

  const saveLibrarySettings = () => {
    if (!settingsChanged) return;
    onLibrarySettingsChange(draftLibrarySettings);
    onClose();
  };

  const resetPlaybackSettings = () => {
    setDraftPlaybackSettings(savedPlaybackSettings);
  };

  const savePlaybackSettings = () => {
    if (!playbackSettingsChanged) return;
    onPlaybackSettingsChange(draftPlaybackSettings);
    onClose();
  };

  const updateDraftTransparency = (appTransparency: number) => {
    setDraftAppearanceSettings({
      ...draftAppearanceSettings,
      appTransparency,
    });
    onAppearancePreviewChange(appTransparency);
  };

  const resetAppearanceSettings = () => {
    setDraftAppearanceSettings(savedAppearanceSettings);
    onAppearancePreviewChange(savedAppearanceSettings.appTransparency);
  };

  const saveAppearanceSettings = () => {
    if (!appearanceSettingsChanged) return;
    onAppearanceSettingsChange(draftAppearanceSettings);
    onClose();
  };

  const runAdvancedAction = async (action: AdvancedSettingsAction) => {
    if (destructiveAdvancedActions.has(action)) {
      setAdvancedActionPendingConfirmation(action);
      return;
    }
    await executeAdvancedAction(action);
  };

  const executeAdvancedAction = async (action: AdvancedSettingsAction) => {
    setPendingAdvancedAction(action);
    try {
      await onAdvancedAction(action);
    } catch {
      // The action handlers own user-facing failure copy for now.
    } finally {
      setPendingAdvancedAction(null);
      setAdvancedActionPendingConfirmation(null);
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !hasUnsavedChanges) onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasUnsavedChanges, onClose]);

  return createPortal(
    <DialogOverlay
      {...dialogOverlayMotion}
      className={`app-modal-overlay no-drag fixed inset-0 z-[10000] grid place-items-center px-5 ${
        isTransparencyPreviewing ? "bg-transparent backdrop-blur-none" : "bg-black/40"
      }`}
      style={
        isTransparencyPreviewing
          ? {
              borderRadius: 49,
              overflow: "hidden",
              backdropFilter: "none",
              WebkitBackdropFilter: "none",
            }
          : undefined
      }
      onPointerDown={() => {
        if (!hasUnsavedChanges) onClose();
      }}
    >
      <DialogPanel
        {...dialogPanelMotion}
        className={`flex h-155 w-full max-w-205 overflow-hidden rounded-4xl border border-white/10 bg-[rgba(10,10,10,0.96)] shadow-2xl backdrop-blur-3xl ${
          isTransparencyPreviewing ? "border-0 bg-transparent shadow-none backdrop-blur-none" : ""
        }`}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <aside
          className={`flex w-[210px] shrink-0 flex-col bg-white/[0.035] p-3 transition-opacity ${
            isTransparencyPreviewing ? "pointer-events-none opacity-0" : ""
          }`}
        >
          <div className="pt-3 px-3.5">
            <h3 className="font-semibold">Playhead Settings</h3>
          </div>
          <nav className="flex flex-col gap-1 pt-7">
            {categories.map((category) => {
              const CategoryIcon = category.icon;

              return (
                <button
                  key={category.label}
                  type="button"
                  className={`flex h-10 items-center gap-2 rounded-[16px] px-3 text-left text-[13px] font-medium transition ${
                    activeCategory === category.id
                      ? "bg-white/10 text-foreground"
                      : "text-muted-foreground hover:bg-white/[0.065] hover:text-foreground"
                  }`}
                  onClick={() => setActiveCategory(category.id)}
                >
                  <CategoryIcon size={16} strokeWidth={1.8} />
                  <span>{category.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <div
            className={`flex h-18 shrink-0 items-center justify-between px-5 transition-opacity ${
              isTransparencyPreviewing ? "pointer-events-none opacity-0" : ""
            }`}
          >
            <div>
              <h3 className="text-[15px] font-semibold leading-5 text-foreground">
                {activeCategoryMeta.label}
              </h3>
              <p className="mt-0.5 text-[12px] font-medium leading-4 text-muted-foreground">
                {activeCategory === "library"
                  ? "Folder scanning and file visibility."
                  : activeCategory === "playback"
                    ? "Keyboard playback behavior."
                    : activeCategory === "appearance"
                      ? "Window transparency and motion."
                      : activeCategory === "shortcuts"
                        ? "Current keyboard controls."
                        : "Maintenance and backup tools."}
              </p>
            </div>
            <button
              type="button"
              className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
              title="Close"
              onClick={onClose}
            >
              <icons.x size={16} strokeWidth={1.8} />
            </button>
          </div>

          <div
            className={`flex min-h-0 flex-1 flex-col px-5 pb-5 ${
              isTransparencyPreviewing && activeCategory !== "appearance"
                ? "pointer-events-none"
                : ""
            }`}
          >
            {activeCategory === "library" ? (
              <>
                <div className="thin-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                  <div className="rounded-[22px] border border-white/10 bg-white/[0.035] p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h4 className="text-[14px] font-semibold leading-5 text-foreground">
                          Display mode
                        </h4>
                        <p className="mt-1 max-w-[420px] text-[12px] font-medium leading-4 text-muted-foreground">
                          Choose how Playhead organizes these folders.
                        </p>
                      </div>
                      <div className="grid grid-cols-2 rounded-full border border-white/10 bg-black/20 p-0.5">
                        {[
                          {
                            mode: "library" as const,
                            label: "Library",
                            icon: icons["list-music"],
                          },
                          { mode: "folder" as const, label: "Folder", icon: FolderOpenIcon },
                        ].map((option) => {
                          const OptionIcon = option.icon;
                          const active = draftLibrarySettings.mode === option.mode;

                          return (
                            <button
                              key={option.mode}
                              type="button"
                              className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold transition ${
                                active
                                  ? "bg-primary text-primary-foreground"
                                  : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
                              }`}
                              onClick={() =>
                                setDraftLibrarySettings({
                                  ...draftLibrarySettings,
                                  mode: option.mode,
                                })
                              }
                            >
                              <OptionIcon size={14} strokeWidth={1.9} />
                              <span>{option.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-white/10 bg-white/[0.035] p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h4 className="text-[14px] font-semibold leading-5 text-foreground">
                          Watched folders
                        </h4>
                        <p className="mt-1 max-w-[420px] text-[12px] font-medium leading-4 text-muted-foreground">
                          Playhead scans these folders and uses them in both modes.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.045] px-3 text-[12px] font-medium text-muted-foreground transition hover:bg-white/[0.075] hover:text-foreground disabled:opacity-45"
                        disabled={isScanning}
                        onClick={onAddLibraryFolder}
                      >
                        {isScanning ? (
                          <icons.loader size={15} strokeWidth={1.8} className="animate-spin" />
                        ) : (
                          <FolderPlusIcon size={15} strokeWidth={1.8} />
                        )}
                        <span>{isScanning ? "Scanning..." : "Add Folder"}</span>
                      </button>
                    </div>

                    <div className="mt-4 space-y-2">
                      {libraryFolders.length === 0 ? (
                        <div className="rounded-[16px] border border-white/10 bg-white/[0.03] px-3 py-3">
                          <p className="text-[12px] font-medium leading-4 text-muted-foreground">
                            No folders added yet.
                          </p>
                        </div>
                      ) : (
                        libraryFolders.map((folder) => (
                          <div
                            key={folder.id}
                            className="flex min-h-12 items-center gap-3 rounded-[16px] border border-white/10 bg-white/[0.03] px-3 py-2"
                          >
                            <FolderOpenIcon
                              size={18}
                              strokeWidth={1.8}
                              className="shrink-0 text-muted-foreground"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[13px] font-semibold leading-4 text-foreground">
                                {folder.name}
                              </p>
                              <p className="mt-0.5 truncate text-[11px] font-medium leading-4 text-muted-foreground">
                                {folder.path}
                              </p>
                            </div>
                            <span className="shrink-0 font-mono text-[11px] font-medium text-muted-foreground">
                              {folder.trackIds.length}
                            </span>
                            <button
                              type="button"
                              className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-red-500/15 hover:text-red-300"
                              title={`Remove ${folder.name}`}
                              onClick={() => onRemoveLibraryFolder(folder)}
                            >
                              <icons.x size={15} strokeWidth={1.9} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-white/10 bg-white/[0.035] p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h4 className="text-[14px] font-semibold leading-5 text-foreground">
                          File formats
                        </h4>
                        <p className="mt-1 max-w-[420px] text-[12px] font-medium leading-4 text-muted-foreground">
                          Choose which audio files Playhead scans and shows in folders.
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2">
                      {fileFormatOptions.map((format) => {
                        const checked = draftLibrarySettings.enabledAudioExtensions.includes(
                          format.extension,
                        );

                        return (
                          <button
                            key={format.extension}
                            type="button"
                            className={`flex h-9 items-center justify-between rounded-[14px] border px-3 text-[13px] font-medium transition ${
                              checked
                                ? "border-primary/45 bg-primary/15 text-foreground"
                                : "border-white/10 bg-white/[0.035] text-muted-foreground hover:bg-white/[0.07] hover:text-foreground"
                            }`}
                            onClick={() => toggleExtension(format.extension)}
                          >
                            <span>{format.label}</span>
                            <span
                              className={`grid size-4 place-items-center rounded-[5px] border ${
                                checked
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-white/15"
                              }`}
                            >
                              {checked && <CheckIcon size={12} strokeWidth={2.2} />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-white/10 bg-white/[0.035] p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h4 className="text-[14px] font-semibold leading-5 text-foreground">
                          Watch folders
                        </h4>
                        <p className="mt-1 max-w-[420px] text-[12px] font-medium leading-4 text-muted-foreground">
                          Keep folders updated when music files are added, changed, or removed.
                        </p>
                      </div>
                      <Switch
                        checked={draftLibrarySettings.watchFolders}
                        onCheckedChange={(checked) =>
                          setDraftLibrarySettings({
                            ...draftLibrarySettings,
                            watchFolders: checked,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-white/10 bg-white/[0.035] p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h4 className="text-[14px] font-semibold leading-5 text-foreground">
                          Rescan on launch
                        </h4>
                        <p className="mt-1 max-w-[420px] text-[12px] font-medium leading-4 text-muted-foreground">
                          Refresh folders each time Playhead opens.
                        </p>
                      </div>
                      <Switch
                        checked={draftLibrarySettings.rescanOnLaunch}
                        onCheckedChange={(checked) =>
                          setDraftLibrarySettings({
                            ...draftLibrarySettings,
                            rescanOnLaunch: checked,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex shrink-0 items-center justify-between">
                  <span className="text-[12px] font-medium text-muted-foreground">
                    {isScanning
                      ? "Saving and rescanning..."
                      : settingsChanged
                        ? "Changes will apply after saving."
                        : "Library settings are up to date."}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="h-9 rounded-full px-4 text-[13px] font-medium text-muted-foreground transition hover:bg-white/10 hover:text-foreground disabled:opacity-40"
                      disabled={!settingsChanged || isScanning}
                      onClick={resetLibrarySettings}
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      className="h-9 rounded-full bg-primary px-4 text-[13px] font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-45"
                      disabled={!settingsChanged || isScanning}
                      onClick={saveLibrarySettings}
                    >
                      Save
                    </button>
                  </div>
                </div>
              </>
            ) : activeCategory === "playback" ? (
              <>
                <div className="thin-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                  <SettingsOptionGroup
                    title="Seek step"
                    description="Choose how far left and right arrows jump."
                    options={[
                      { label: "5s", value: 5 },
                      { label: "10s", value: 10 },
                      { label: "15s", value: 15 },
                      { label: "30s", value: 30 },
                    ]}
                    value={draftPlaybackSettings.seekStepSeconds}
                    onChange={(value) =>
                      setDraftPlaybackSettings({
                        ...draftPlaybackSettings,
                        seekStepSeconds: value,
                      })
                    }
                  />

                  <SettingsOptionGroup
                    title="Volume step"
                    description="Choose how much up and down arrows change volume."
                    options={[
                      { label: "2%", value: 2 },
                      { label: "5%", value: 5 },
                      { label: "10%", value: 10 },
                    ]}
                    value={draftPlaybackSettings.volumeStepPercent}
                    onChange={(value) =>
                      setDraftPlaybackSettings({
                        ...draftPlaybackSettings,
                        volumeStepPercent: value,
                      })
                    }
                  />

                  <div className="rounded-[22px] border border-white/10 bg-white/[0.035] p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h4 className="text-[14px] font-semibold leading-5 text-foreground">
                          Remember playback position
                        </h4>
                        <p className="mt-1 max-w-[420px] text-[12px] font-medium leading-4 text-muted-foreground">
                          Resume tracks where you left off.
                        </p>
                      </div>
                      <Switch
                        checked={draftPlaybackSettings.rememberTrackPositions}
                        onCheckedChange={(checked) =>
                          setDraftPlaybackSettings({
                            ...draftPlaybackSettings,
                            rememberTrackPositions: checked,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-white/10 bg-white/[0.035] p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h4 className="text-[14px] font-semibold leading-5 text-foreground">
                          Restore last session
                        </h4>
                        <p className="mt-1 max-w-[420px] text-[12px] font-medium leading-4 text-muted-foreground">
                          Reopen the last track paused at its saved position.
                        </p>
                      </div>
                      <Switch
                        checked={draftPlaybackSettings.restoreLastSession}
                        onCheckedChange={(checked) =>
                          setDraftPlaybackSettings({
                            ...draftPlaybackSettings,
                            restoreLastSession: checked,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-white/10 bg-white/[0.035] p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h4 className="text-[14px] font-semibold leading-5 text-foreground">
                          Skip unavailable tracks
                        </h4>
                        <p className="mt-1 max-w-[420px] text-[12px] font-medium leading-4 text-muted-foreground">
                          Try the next track when a file cannot be loaded.
                        </p>
                      </div>
                      <Switch
                        checked={draftPlaybackSettings.skipUnavailableTracks}
                        onCheckedChange={(checked) =>
                          setDraftPlaybackSettings({
                            ...draftPlaybackSettings,
                            skipUnavailableTracks: checked,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex shrink-0 items-center justify-between">
                  <span className="text-[12px] font-medium text-muted-foreground">
                    {playbackSettingsChanged
                      ? "Changes will apply after saving."
                      : "Playback settings are up to date."}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="h-9 rounded-full px-4 text-[13px] font-medium text-muted-foreground transition hover:bg-white/10 hover:text-foreground disabled:opacity-40"
                      disabled={!playbackSettingsChanged}
                      onClick={resetPlaybackSettings}
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      className="h-9 rounded-full bg-primary px-4 text-[13px] font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-45"
                      disabled={!playbackSettingsChanged}
                      onClick={savePlaybackSettings}
                    >
                      Save
                    </button>
                  </div>
                </div>
              </>
            ) : activeCategory === "appearance" ? (
              <>
                <div className="thin-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                  <div
                    className={`rounded-[22px] border border-white/10 bg-white/[0.035] p-4 transition-opacity ${
                      isTransparencyPreviewing ? "pointer-events-auto border-0 !bg-transparent" : ""
                    }`}
                  >
                    <div
                      className={`transition-opacity ${
                        isTransparencyPreviewing ? "pointer-events-none opacity-0" : ""
                      }`}
                    >
                      <h4 className="text-[14px] font-semibold leading-5 text-foreground">
                        App transparency
                      </h4>
                      <p className="mt-1 max-w-[420px] text-[12px] font-medium leading-4 text-muted-foreground">
                        Adjust how much of the desktop shows through Playhead.
                      </p>
                    </div>
                    <TransparencySlider
                      value={draftAppearanceSettings.appTransparency}
                      onChange={updateDraftTransparency}
                      onPreviewStart={() => setIsTransparencyPreviewing(true)}
                      onPreviewEnd={() => setIsTransparencyPreviewing(false)}
                    />
                  </div>

                  <div
                    className={`rounded-[22px] border border-white/10 bg-white/[0.035] p-4 transition-opacity ${
                      isTransparencyPreviewing
                        ? "pointer-events-none border-transparent bg-transparent opacity-0"
                        : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h4 className="text-[14px] font-semibold leading-5 text-foreground">
                          Reduce motion
                        </h4>
                        <p className="mt-1 max-w-[420px] text-[12px] font-medium leading-4 text-muted-foreground">
                          Simplify animation and transition effects.
                        </p>
                      </div>
                      <Switch
                        checked={draftAppearanceSettings.reduceMotion}
                        onCheckedChange={(checked) =>
                          setDraftAppearanceSettings({
                            ...draftAppearanceSettings,
                            reduceMotion: checked,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex shrink-0 items-center justify-between">
                  <span className="text-[12px] font-medium text-muted-foreground">
                    {appearanceSettingsChanged
                      ? "Changes will apply after saving."
                      : "Appearance settings are up to date."}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="h-9 rounded-full px-4 text-[13px] font-medium text-muted-foreground transition hover:bg-white/10 hover:text-foreground disabled:opacity-40"
                      disabled={!appearanceSettingsChanged}
                      onClick={resetAppearanceSettings}
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      className="h-9 rounded-full bg-primary px-4 text-[13px] font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-45"
                      disabled={!appearanceSettingsChanged}
                      onClick={saveAppearanceSettings}
                    >
                      Save
                    </button>
                  </div>
                </div>
              </>
            ) : activeCategory === "shortcuts" ? (
              <div className="overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.035]">
                {shortcuts.map((shortcut, index) => (
                  <div
                    key={shortcut.action}
                    className={`flex min-h-[58px] items-center justify-between gap-4 px-4 py-3 ${
                      index > 0 ? "border-t border-white/10" : ""
                    }`}
                  >
                    <div>
                      <p className="text-[13px] font-semibold leading-5 text-foreground">
                        {shortcut.action}
                      </p>
                      {shortcut.detail && (
                        <p className="text-[12px] font-medium leading-4 text-muted-foreground">
                          {shortcut.detail}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {[...shortcut.keys, ...(shortcut.secondaryKeys || [])].map((key) => (
                        <kbd
                          key={key}
                          className="rounded-[9px] border border-white/10 bg-white/10 px-2 py-1 font-mono text-[11px] font-medium leading-none text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="thin-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                  {advancedActions.map((action) => {
                    const ActionIcon = action.icon;
                    const isPending = pendingAdvancedAction === action.id;

                    return (
                      <button
                        key={action.id}
                        type="button"
                        className="group flex w-full items-center justify-between gap-4 rounded-[22px] border border-white/10 bg-white/[0.035] p-4 text-left transition hover:bg-white/[0.065]"
                        disabled={Boolean(pendingAdvancedAction)}
                        onClick={() => void runAdvancedAction(action.id)}
                      >
                        <span className="flex min-w-0 items-start gap-3">
                          <span className="grid size-9 shrink-0 place-items-center rounded-[14px] bg-white/10 text-muted-foreground">
                            <ActionIcon size={17} strokeWidth={1.8} />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[14px] font-semibold leading-5 text-foreground">
                              {action.title}
                            </span>
                            <span className="mt-1 block max-w-[460px] text-[12px] font-medium leading-4 text-muted-foreground">
                              {action.description}
                            </span>
                          </span>
                        </span>
                        <span className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition group-hover:text-foreground">
                          {isPending ? (
                            <icons.loader size={16} strokeWidth={1.8} className="animate-spin" />
                          ) : (
                            <ChevronRightIcon size={17} strokeWidth={1.8} />
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>
      </DialogPanel>
      {advancedActionPendingConfirmation && (
        <DialogOverlay
          {...dialogOverlayMotion}
          className="app-modal-overlay no-drag fixed inset-0 z-[10001] grid place-items-center bg-black/40 px-5"
          onPointerDown={() => setAdvancedActionPendingConfirmation(null)}
        >
          <DialogPanel
            {...dialogPanelMotion}
            className="w-full max-w-[390px] rounded-[28px] border border-white/10 bg-[rgba(10,10,10,0.96)] p-3 shadow-2xl"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-2 pt-1">
              <div>
                <h2 className="text-[15px] font-semibold leading-6 text-foreground">
                  {advancedConfirmationCopy[advancedActionPendingConfirmation].title}
                </h2>
                <p className="mt-1 text-[13px] font-medium leading-5 text-muted-foreground">
                  {advancedConfirmationCopy[advancedActionPendingConfirmation].description}
                </p>
              </div>
              <button
                type="button"
                className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
                title="Close"
                onClick={() => setAdvancedActionPendingConfirmation(null)}
              >
                <icons.x size={16} strokeWidth={1.8} />
              </button>
            </div>

            <div className="mt-4 flex justify-end gap-2 px-2 pb-1">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setAdvancedActionPendingConfirmation(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-red-500 text-white hover:bg-red-400 active:bg-red-600"
                disabled={Boolean(pendingAdvancedAction)}
                onClick={() => void executeAdvancedAction(advancedActionPendingConfirmation)}
              >
                {advancedConfirmationCopy[advancedActionPendingConfirmation].actionLabel}
              </Button>
            </div>
          </DialogPanel>
        </DialogOverlay>
      )}
    </DialogOverlay>,
    document.body,
  );
}

function TransparencySlider({
  value,
  onChange,
  onPreviewStart,
  onPreviewEnd,
}: {
  value: number;
  onChange: (value: number) => void;
  onPreviewStart: () => void;
  onPreviewEnd: () => void;
}) {
  return (
    <div className="mt-4">
      <Slider
        value={value}
        onChange={(nextValue) => {
          if (typeof nextValue === "number") onChange(nextValue);
        }}
        min={45}
        max={100}
        step={1}
        showValue
        valuePosition="tooltip"
        label="Transparency"
        formatValue={(nextValue) => `${nextValue}%`}
        className="no-drag cursor-ew-resize"
        trackClassName="cursor-ew-resize"
        onInteractionStart={onPreviewStart}
        onInteractionEnd={onPreviewEnd}
      />
    </div>
  );
}

function SettingsOptionGroup({
  title,
  description,
  options,
  value,
  onChange,
}: {
  title: string;
  description: string;
  options: Array<{ label: string; value: number }>;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="text-[14px] font-semibold leading-5 text-foreground">{title}</h4>
          <p className="mt-1 max-w-[420px] text-[12px] font-medium leading-4 text-muted-foreground">
            {description}
          </p>
        </div>
        <div className="flex shrink-0 rounded-full bg-white/[0.06] p-1">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`h-7 rounded-full px-3 text-[12px] font-medium transition ${
                value === option.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
