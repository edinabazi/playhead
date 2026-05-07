import { motion } from "framer-motion";
import playheadIcon from "@/assets/playhead-icon.png";
import { useIcons } from "@/lib/icon-context";
import { getFolderPickerName } from "@/lib/platform";
import { cn } from "@/lib/utils";
import type { LibraryMode } from "../../../../shared/library";

export function EmptyLibraryState({
  isScanning,
  libraryMode,
  onLibraryModeChange,
  onAddFolder,
  onDropFolderPaths,
}: {
  isScanning: boolean;
  libraryMode: LibraryMode;
  onLibraryModeChange: (mode: LibraryMode) => void;
  onAddFolder: () => void;
  onDropFolderPaths: (folderPaths: string[]) => void;
}) {
  const icons = useIcons();
  const FolderPlusIcon = icons["folder-plus"];
  const LibraryIcon = icons["list-music"];
  const FolderIcon = icons["folder-open"];
  const folderPickerName = getFolderPickerName();

  const displayModes = [
    {
      mode: "library" as const,
      label: "Library",
      description: "Combines folders into one library.",
      icon: LibraryIcon,
    },
    {
      mode: "folder" as const,
      label: "Folder",
      description: "Keeps your folders as your library.",
      icon: FolderIcon,
    },
  ];

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.dataset.dragging = "false";

    const folderPaths = Array.from(event.dataTransfer.files)
      .map((file) => window.playhead.getDroppedFilePath(file))
      .filter((folderPath) => folderPath.length > 0);

    if (folderPaths.length > 0) onDropFolderPaths(folderPaths);
  };

  return (
    <motion.section
      className="no-drag flex min-h-0 flex-1 items-center justify-center p-8"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      onDragOver={(event) => {
        event.preventDefault();
        event.currentTarget.dataset.dragging = "true";
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        event.currentTarget.dataset.dragging = "false";
      }}
      onDrop={handleDrop}
    >
      <div className="group w-full max-w-[620px] rounded-[28px] border border-white/[0.09] bg-white/[0.035] p-8 shadow-lg data-[dragging=true]:border-primary/55 data-[dragging=true]:bg-primary/[0.045]">
        <div className="mx-auto grid size-16 place-items-center overflow-hidden rounded-2xl">
          <img className="size-16" src={playheadIcon} alt="" draggable={false} />
        </div>

        <div className="mx-auto mt-5 max-w-[420px] text-center">
          <h2 className="text-balance text-[30px] font-semibold tracking-tighter leading-tight text-foreground">
            Set up Playhead
          </h2>
          <p className="mt-2 text-pretty text-[14px] font-medium leading-[1.35] text-muted-foreground">
            Choose how Playhead should display your collection, <br />
            then add a folder.
          </p>
        </div>

        <div className="mx-auto mt-7 max-w-[500px]">
          <p className="mb-2 pl-1 text-left text-[12px] font-semibold leading-4 text-foreground">
            Display mode
          </p>
          <div className="grid grid-cols-2 gap-1 rounded-2xl border border-white/10 bg-black/15 p-1">
            {displayModes.map((option) => {
              const OptionIcon = option.icon;
              const active = libraryMode === option.mode;

              return (
                <button
                  key={option.mode}
                  type="button"
                  aria-pressed={active}
                  className={cn(
                    "flex min-h-12 items-center gap-2 rounded-[14px] px-3 text-left transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground",
                  )}
                  onClick={() => onLibraryModeChange(option.mode)}
                >
                  <OptionIcon size={18} strokeWidth={1.9} className="shrink-0" />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold leading-4">
                      {option.label}
                    </span>
                    <span className="block truncate text-[11px] font-medium leading-4 opacity-75">
                      {option.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mx-auto mt-6 max-w-[500px]">
          <p className="mb-2 pl-1 text-left text-[12px] font-semibold leading-4 text-foreground">
            Add your music
          </p>
          <button
            type="button"
            className="no-drag flex min-h-[132px] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.035] px-6 py-6 text-center transition-colors hover:border-primary/45 hover:bg-primary/[0.07] disabled:opacity-55 group-data-[dragging=true]:border-primary/65 group-data-[dragging=true]:bg-primary/[0.1]"
            title="Add folder"
            disabled={isScanning}
            onClick={onAddFolder}
          >
            <span className="grid size-10 place-items-center rounded-xl border border-white/10 bg-white/[0.05] text-foreground">
              <FolderPlusIcon size={20} strokeWidth={1.9} />
            </span>
            <span className="mt-3 text-[14px] font-semibold leading-5 text-foreground">
              {isScanning ? "Scanning..." : "Drop folders here"}
            </span>
            <span className="mt-1 text-pretty text-[12px] font-medium leading-5 text-muted-foreground">
              or click to choose from {folderPickerName}
            </span>
          </button>
        </div>
      </div>
    </motion.section>
  );
}
