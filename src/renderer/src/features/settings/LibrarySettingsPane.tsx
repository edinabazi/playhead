import { Switch } from "@/components/ui/switch";
import type { IconComponent } from "@/lib/icon-context";
import type { LibraryFolder, LibrarySettings } from "../../../../shared/library";
import { SettingsFooter } from "./SettingsControls";
import { fileFormatOptions } from "./settings-config";

export function LibrarySettingsPane({
  settings,
  folders,
  changed,
  isScanning,
  icons,
  onChange,
  onToggleExtension,
  onAddFolder,
  onRemoveFolder,
  onReset,
  onSave,
}: {
  settings: LibrarySettings;
  folders: LibraryFolder[];
  changed: boolean;
  isScanning: boolean;
  icons: {
    check: IconComponent;
    folderOpen: IconComponent;
    folderPlus: IconComponent;
    listMusic: IconComponent;
    loader: IconComponent;
    x: IconComponent;
  };
  onChange: (settings: LibrarySettings) => void;
  onToggleExtension: (extension: string) => void;
  onAddFolder: () => void;
  onRemoveFolder: (folder: LibraryFolder) => void;
  onReset: () => void;
  onSave: () => void;
}) {
  const FolderOpenIcon = icons.folderOpen;
  const FolderPlusIcon = icons.folderPlus;

  return (
    <>
      <div className="thin-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        <DisplayModeCard
          settings={settings}
          folderIcon={FolderOpenIcon}
          libraryIcon={icons.listMusic}
          onChange={onChange}
        />
        <WatchedFoldersCard
          folders={folders}
          isScanning={isScanning}
          folderIcon={FolderOpenIcon}
          folderPlusIcon={FolderPlusIcon}
          loaderIcon={icons.loader}
          removeIcon={icons.x}
          onAddFolder={onAddFolder}
          onRemoveFolder={onRemoveFolder}
        />
        <FileFormatsCard
          settings={settings}
          checkIcon={icons.check}
          onToggleExtension={onToggleExtension}
        />
        <LibrarySwitch
          title="Watch folders"
          description="Keep folders updated when music files are added, changed, or removed."
          checked={settings.watchFolders}
          onCheckedChange={(checked) => onChange({ ...settings, watchFolders: checked })}
        />
        <LibrarySwitch
          title="Rescan on launch"
          description="Refresh folders each time Playhead opens."
          checked={settings.rescanOnLaunch}
          onCheckedChange={(checked) => onChange({ ...settings, rescanOnLaunch: checked })}
        />
      </div>

      <SettingsFooter
        status={
          isScanning
            ? "Saving and rescanning..."
            : changed
              ? "Changes will apply after saving."
              : "Library settings are up to date."
        }
        changed={changed}
        disabled={isScanning}
        onReset={onReset}
        onSave={onSave}
      />
    </>
  );
}

function DisplayModeCard({
  settings,
  folderIcon,
  libraryIcon,
  onChange,
}: {
  settings: LibrarySettings;
  folderIcon: IconComponent;
  libraryIcon: IconComponent;
  onChange: (settings: LibrarySettings) => void;
}) {
  const options = [
    { mode: "library" as const, label: "Library", icon: libraryIcon },
    { mode: "folder" as const, label: "Folder", icon: folderIcon },
  ];

  return (
    <div className="rounded-[22px] border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="text-[14px] font-semibold leading-5 text-foreground">Display mode</h4>
          <p className="mt-1 max-w-[420px] text-[12px] font-medium leading-4 text-muted-foreground">
            Choose how Playhead organizes these folders.
          </p>
        </div>
        <div className="grid grid-cols-2 rounded-full border border-white/10 bg-black/20 p-0.5">
          {options.map((option) => {
            const OptionIcon = option.icon;
            const active = settings.mode === option.mode;

            return (
              <button
                key={option.mode}
                type="button"
                className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold transition ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
                }`}
                onClick={() => onChange({ ...settings, mode: option.mode })}
              >
                <OptionIcon size={14} strokeWidth={1.9} />
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function WatchedFoldersCard({
  folders,
  isScanning,
  folderIcon: FolderOpenIcon,
  folderPlusIcon: FolderPlusIcon,
  loaderIcon: LoaderIcon,
  removeIcon: RemoveIcon,
  onAddFolder,
  onRemoveFolder,
}: {
  folders: LibraryFolder[];
  isScanning: boolean;
  folderIcon: IconComponent;
  folderPlusIcon: IconComponent;
  loaderIcon: IconComponent;
  removeIcon: IconComponent;
  onAddFolder: () => void;
  onRemoveFolder: (folder: LibraryFolder) => void;
}) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h4 className="text-[14px] font-semibold leading-5 text-foreground">Watched folders</h4>
          <p className="mt-1 max-w-[420px] text-[12px] font-medium leading-4 text-muted-foreground">
            Playhead scans these folders and uses them in both modes.
          </p>
        </div>
        <button
          type="button"
          className="flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.045] px-3 text-[12px] font-medium text-muted-foreground transition hover:bg-white/[0.075] hover:text-foreground disabled:opacity-45"
          disabled={isScanning}
          onClick={onAddFolder}
        >
          {isScanning ? (
            <LoaderIcon size={15} strokeWidth={1.8} className="animate-spin" />
          ) : (
            <FolderPlusIcon size={15} strokeWidth={1.8} />
          )}
          <span>{isScanning ? "Scanning..." : "Add Folder"}</span>
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {folders.length === 0 ? (
          <div className="rounded-[16px] border border-white/10 bg-white/[0.03] px-3 py-3">
            <p className="text-[12px] font-medium leading-4 text-muted-foreground">
              No folders added yet.
            </p>
          </div>
        ) : (
          folders.map((folder) => (
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
                onClick={() => onRemoveFolder(folder)}
              >
                <RemoveIcon size={15} strokeWidth={1.9} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function FileFormatsCard({
  settings,
  checkIcon: CheckIcon,
  onToggleExtension,
}: {
  settings: LibrarySettings;
  checkIcon: IconComponent;
  onToggleExtension: (extension: string) => void;
}) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="text-[14px] font-semibold leading-5 text-foreground">File formats</h4>
          <p className="mt-1 max-w-[420px] text-[12px] font-medium leading-4 text-muted-foreground">
            Choose which audio files Playhead scans and shows in folders.
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {fileFormatOptions.map((format) => {
          const checked = settings.enabledAudioExtensions.includes(format.extension);

          return (
            <button
              key={format.extension}
              type="button"
              className={`flex h-9 items-center justify-between rounded-[14px] border px-3 text-[13px] font-medium transition ${
                checked
                  ? "border-primary/45 bg-primary/15 text-foreground"
                  : "border-white/10 bg-white/[0.035] text-muted-foreground hover:bg-white/[0.07] hover:text-foreground"
              }`}
              onClick={() => onToggleExtension(format.extension)}
            >
              <span>{format.label}</span>
              <span
                className={`grid size-4 place-items-center rounded-[5px] border ${
                  checked ? "border-primary bg-primary text-primary-foreground" : "border-white/15"
                }`}
              >
                {checked && <CheckIcon size={12} strokeWidth={2.2} />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LibrarySwitch({
  title,
  description,
  checked,
  onCheckedChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h4 className="text-[14px] font-semibold leading-5 text-foreground">{title}</h4>
          <p className="mt-1 max-w-[420px] text-[12px] font-medium leading-4 text-muted-foreground">
            {description}
          </p>
        </div>
        <Switch checked={checked} onCheckedChange={onCheckedChange} />
      </div>
    </div>
  );
}
