import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  defaultAppearanceSettings,
  defaultLibrarySettings,
  defaultPlaybackSettings,
  defaultSoundCloudSettings,
  defaultTelemetrySettings,
  type AppearanceSettings,
  type LastfmSettings,
  type LastfmState,
  type LibraryFolder,
  type LibrarySettings,
  type PlaybackSettings,
  type SoundCloudSettings,
  type SoundCloudState,
  type TelemetrySettings,
} from "../../../../shared/library";
import {
  DialogOverlay,
  DialogPanel,
  dialogOverlayMotion,
  dialogPanelMotion,
} from "@/components/ui/dialog-motion";
import { showSimpleActionToast } from "@/features/toasts/action-toasts";
import { useIcons } from "@/lib/icon-context";
import { getPrimaryModifierLabel } from "@/lib/platform";
import {
  advancedConfirmationCopy,
  destructiveAdvancedActions,
  fileFormatOptions,
  settingsHeaderDescriptions,
  type SettingsCategoryId,
} from "./settings-config";
import { AdvancedSettingsPane } from "./AdvancedSettingsPane";
import { AppearanceSettingsPane } from "./AppearanceSettingsPane";
import { IntegrationsSettingsPane } from "./IntegrationsSettingsPane";
import { LibrarySettingsPane } from "./LibrarySettingsPane";
import { PlaybackSettingsPane } from "./PlaybackSettingsPane";
import { ShortcutsSettingsPane } from "./ShortcutsSettingsPane";

export type AdvancedSettingsAction =
  | "open-data-folder"
  | "clear-waveform-cache"
  | "rebuild-library-index"
  | "reset-app-state"
  | "export-library-backup"
  | "import-library-backup";

export function SettingsDialog({
  librarySettings,
  libraryFolders,
  isScanning,
  onAddLibraryFolder,
  onDropLibraryFolderPaths,
  onLibrarySettingsChange,
  onRemoveLibraryFolder,
  playbackSettings,
  onPlaybackSettingsChange,
  appearanceSettings,
  onAppearanceSettingsChange,
  onAppearancePreviewChange,
  telemetrySettings,
  onTelemetrySettingsChange,
  lastfmState,
  lastfmSettings,
  lastfmActionPending,
  soundcloudState,
  soundcloudSettings,
  soundcloudActionPending,
  onLastfmSettingsChange,
  onStartLastfmAuth,
  onCompleteLastfmAuth,
  onCancelLastfmAuth,
  onDisconnectLastfm,
  onFlushLastfmQueue,
  onSoundCloudSettingsChange,
  onStartSoundCloudAuth,
  onCompleteSoundCloudAuth,
  onDisconnectSoundCloud,
  onAdvancedAction,
  batchAnalysis,
  onAnalyzeMissingAudioData,
  onClose,
}: {
  librarySettings: LibrarySettings;
  libraryFolders: LibraryFolder[];
  isScanning: boolean;
  onAddLibraryFolder: () => void;
  onDropLibraryFolderPaths: (folderPaths: string[]) => void;
  onLibrarySettingsChange: (settings: LibrarySettings) => void;
  onRemoveLibraryFolder: (folder: LibraryFolder) => void;
  playbackSettings: PlaybackSettings;
  onPlaybackSettingsChange: (settings: PlaybackSettings) => void;
  appearanceSettings: AppearanceSettings;
  onAppearanceSettingsChange: (settings: AppearanceSettings) => void;
  onAppearancePreviewChange: (appTransparency: number | null) => void;
  telemetrySettings: TelemetrySettings;
  onTelemetrySettingsChange: (settings: TelemetrySettings) => void;
  lastfmState: LastfmState;
  lastfmSettings: LastfmSettings;
  lastfmActionPending: boolean;
  soundcloudState: SoundCloudState;
  soundcloudSettings: SoundCloudSettings;
  soundcloudActionPending: boolean;
  onLastfmSettingsChange: (settings: LastfmSettings) => void;
  onStartLastfmAuth: () => void;
  onCompleteLastfmAuth: () => void;
  onCancelLastfmAuth: () => void;
  onDisconnectLastfm: () => void;
  onFlushLastfmQueue: () => void;
  onSoundCloudSettingsChange: (settings: SoundCloudSettings) => void;
  onStartSoundCloudAuth: () => void;
  onCompleteSoundCloudAuth: (input: string) => void;
  onDisconnectSoundCloud: () => void;
  onAdvancedAction: (action: AdvancedSettingsAction) => Promise<string>;
  batchAnalysis: {
    status: "idle" | "running" | "complete";
    total: number;
    completed: number;
    failed: number;
    currentTrackTitle: string;
  };
  onAnalyzeMissingAudioData: () => Promise<string>;
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
    watchFolders: true,
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
  const [draftTelemetrySettings, setDraftTelemetrySettings] = useState<TelemetrySettings>(() => ({
    ...defaultTelemetrySettings(),
    ...telemetrySettings,
  }));
  const [isTransparencyPreviewing, setIsTransparencyPreviewing] = useState(false);
  const [pendingAdvancedAction, setPendingAdvancedAction] = useState<AdvancedSettingsAction | null>(
    null,
  );
  const [audioAnalysisPending, setAudioAnalysisPending] = useState(false);
  const [advancedActionPendingConfirmation, setAdvancedActionPendingConfirmation] =
    useState<AdvancedSettingsAction | null>(null);
  const modifierLabel = getPrimaryModifierLabel();
  const savedSettings = { ...defaultLibrarySettings(), ...librarySettings, watchFolders: true };
  const savedPlaybackSettings = { ...defaultPlaybackSettings(), ...playbackSettings };
  const savedAppearanceSettings = { ...defaultAppearanceSettings(), ...appearanceSettings };
  const savedTelemetrySettings = { ...defaultTelemetrySettings(), ...telemetrySettings };
  const savedSoundCloudSettings = { ...defaultSoundCloudSettings(), ...soundcloudSettings };
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
  const telemetrySettingsChanged =
    savedTelemetrySettings.enabled !== draftTelemetrySettings.enabled;
  const hasUnsavedChanges =
    settingsChanged ||
    playbackSettingsChanged ||
    appearanceSettingsChanged ||
    telemetrySettingsChanged;
  const categories = [
    { id: "library", label: "Library", icon: FolderOpenIcon },
    { id: "playback", label: "Playback", icon: icons.play },
    { id: "appearance", label: "Appearance", icon: icons.palette },
    { id: "shortcuts", label: "Shortcuts", icon: icons.keyboard },
    { id: "integrations", label: "Integrations", icon: icons["radio-tower"] },
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
    { action: "Select previous track", keys: ["↑"], detail: "Hold Shift to jump 10 tracks." },
    { action: "Select next track", keys: ["↓"], detail: "Hold Shift to jump 10 tracks." },
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
    onLibrarySettingsChange({ ...draftLibrarySettings, watchFolders: true });
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

  const resetTelemetrySettings = () => {
    setDraftTelemetrySettings(savedTelemetrySettings);
  };

  const resetAdvancedSettings = () => {
    resetLibrarySettings();
    resetTelemetrySettings();
  };

  const saveAdvancedSettings = () => {
    if (settingsChanged) onLibrarySettingsChange({ ...draftLibrarySettings, watchFolders: true });
    if (telemetrySettingsChanged) onTelemetrySettingsChange(draftTelemetrySettings);
    if (settingsChanged || telemetrySettingsChanged) onClose();
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
      const message = await onAdvancedAction(action);
      showSimpleActionToast(
        message,
        message.includes("canceled") || message.startsWith("Add a folder") ? "info" : "success",
      );
    } catch (error) {
      showSimpleActionToast(
        error instanceof Error ? error.message : "That action could not be completed.",
        "error",
      );
    } finally {
      setPendingAdvancedAction(null);
      setAdvancedActionPendingConfirmation(null);
    }
  };

  const runAudioAnalysis = async () => {
    setAudioAnalysisPending(true);
    try {
      const message = await onAnalyzeMissingAudioData();
      showSimpleActionToast(
        message,
        message.includes("already") || message.startsWith("All tracks") ? "info" : "success",
      );
    } catch (error) {
      showSimpleActionToast(
        error instanceof Error ? error.message : "Audio analysis could not be started.",
        "error",
      );
    } finally {
      setAudioAnalysisPending(false);
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
        className={`flex h-[80dvh] w-full max-w-205 overflow-hidden rounded-4xl border border-white/10 bg-[rgba(10,10,10,0.96)] shadow-2xl backdrop-blur-3xl ${
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
          <div className="mt-auto px-3.5 pb-1 text-[11px] leading-4 text-muted-foreground/65">
            <p>Playhead {__APP_VERSION__}</p>
            <p>
              Designed and built by{" "}
              <a
                href="https://edinabazi.com"
                className="hover:text-muted-foreground cursor-pointer!"
              >
                Edin
              </a>
              .
            </p>
          </div>
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
                {settingsHeaderDescriptions[activeCategory]}
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
            className={`relative flex min-h-0 flex-1 flex-col px-5 pb-0 ${
              isTransparencyPreviewing && activeCategory !== "appearance"
                ? "pointer-events-none"
                : ""
            }`}
          >
            {activeCategory === "library" ? (
              <LibrarySettingsPane
                settings={draftLibrarySettings}
                folders={libraryFolders}
                batchAnalysis={batchAnalysis}
                audioAnalysisPending={audioAnalysisPending}
                changed={settingsChanged}
                isScanning={isScanning}
                icons={{
                  audioWaveform: icons["audio-waveform"],
                  check: CheckIcon,
                  chevronRight: ChevronRightIcon,
                  folderOpen: FolderOpenIcon,
                  folderPlus: FolderPlusIcon,
                  listMusic: icons["list-music"],
                  loader: icons.loader,
                  x: icons.x,
                }}
                onChange={setDraftLibrarySettings}
                onToggleExtension={toggleExtension}
                onAddFolder={onAddLibraryFolder}
                onAnalyzeMissingAudioData={() => void runAudioAnalysis()}
                onDropFolderPaths={onDropLibraryFolderPaths}
                onRemoveFolder={onRemoveLibraryFolder}
                onReset={resetLibrarySettings}
                onSave={saveLibrarySettings}
              />
            ) : activeCategory === "playback" ? (
              <PlaybackSettingsPane
                settings={draftPlaybackSettings}
                changed={playbackSettingsChanged}
                onChange={setDraftPlaybackSettings}
                onReset={resetPlaybackSettings}
                onSave={savePlaybackSettings}
              />
            ) : activeCategory === "appearance" ? (
              <AppearanceSettingsPane
                settings={draftAppearanceSettings}
                changed={appearanceSettingsChanged}
                isTransparencyPreviewing={isTransparencyPreviewing}
                onChange={setDraftAppearanceSettings}
                onTransparencyChange={updateDraftTransparency}
                onPreviewStart={() => setIsTransparencyPreviewing(true)}
                onPreviewEnd={() => setIsTransparencyPreviewing(false)}
                onReset={resetAppearanceSettings}
                onSave={saveAppearanceSettings}
              />
            ) : activeCategory === "shortcuts" ? (
              <ShortcutsSettingsPane shortcuts={shortcuts} />
            ) : activeCategory === "integrations" ? (
              <IntegrationsSettingsPane
                lastfmState={lastfmState}
                lastfmSettings={lastfmSettings}
                lastfmPendingAction={lastfmActionPending}
                soundcloudState={soundcloudState}
                soundcloudSettings={savedSoundCloudSettings}
                soundcloudPendingAction={soundcloudActionPending}
                icons={{
                  loader: icons.loader,
                  x: icons.x,
                }}
                onLastfmSettingsChange={onLastfmSettingsChange}
                onConnectLastfm={onStartLastfmAuth}
                onCompleteLastfmAuth={onCompleteLastfmAuth}
                onCancelLastfmAuth={onCancelLastfmAuth}
                onDisconnectLastfm={onDisconnectLastfm}
                onFlushLastfmQueue={onFlushLastfmQueue}
                onSoundCloudSettingsChange={onSoundCloudSettingsChange}
                onConnectSoundCloud={onStartSoundCloudAuth}
                onCompleteSoundCloudAuth={onCompleteSoundCloudAuth}
                onDisconnectSoundCloud={onDisconnectSoundCloud}
              />
            ) : (
              <AdvancedSettingsPane
                actions={advancedActions}
                librarySettings={draftLibrarySettings}
                telemetrySettings={draftTelemetrySettings}
                changed={settingsChanged || telemetrySettingsChanged}
                pendingAction={pendingAdvancedAction}
                loaderIcon={icons.loader}
                chevronRightIcon={ChevronRightIcon}
                onLibrarySettingsChange={setDraftLibrarySettings}
                onTelemetryChange={setDraftTelemetrySettings}
                onReset={resetAdvancedSettings}
                onSave={saveAdvancedSettings}
                onRunAction={(action) => void runAdvancedAction(action)}
              />
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
