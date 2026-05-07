import { motion } from "framer-motion";
import playheadIcon from "@/assets/playhead-icon.png";
import { useIcons } from "@/lib/icon-context";
import { getFolderPickerName } from "@/lib/platform";
import type { LibraryMode } from "../../../../shared/library";

export function EmptyLibraryState({
  isScanning,
  libraryMode,
  onLibraryModeChange,
  onAddFolder,
  onDropFolderPath,
}: {
  isScanning: boolean;
  libraryMode: LibraryMode;
  onLibraryModeChange: (mode: LibraryMode) => void;
  onAddFolder: () => void;
  onDropFolderPath: (folderPath: string) => void;
}) {
  const icons = useIcons();
  const FolderPlusIcon = icons["folder-plus"];
  const folderPickerName = getFolderPickerName();

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.dataset.dragging = "false";

    const file = event.dataTransfer.files[0];
    if (!file) return;

    const folderPath = window.playhead.getDroppedFilePath(file);
    if (folderPath) onDropFolderPath(folderPath);
  };

  return (
    <motion.section
      className="no-drag flex min-h-0 flex-1 items-center justify-center p-8"
      initial={{ opacity: 0, y: 10, filter: "blur(10px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{
        type: "spring",
        stiffness: 360,
        damping: 34,
        mass: 0.8,
        opacity: { duration: 0.2 },
        filter: { duration: 0.24 },
      }}
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
      <div className="group relative grid w-full max-w-[560px] place-items-center overflow-hidden rounded-[36px] border border-white/[0.08] bg-white/[0.035] px-8 py-12 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] data-[dragging=true]:border-primary/60 data-[dragging=true]:bg-primary/[0.05]">
        <div className="absolute inset-0 opacity-80">
          <div className="absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.035] blur-3xl" />
        </div>

        <div className="relative grid size-20 place-items-center overflow-hidden rounded-[24px]">
          <img className="size-20" src={playheadIcon} alt="" draggable={false} />
        </div>

        <div className="relative mt-3">
          <h2 className="text-2xl font-semibold leading-tight tracking-tighter text-foreground">
            Build your library
          </h2>
          <p className="mx-auto mt-3 max-w-[360px] text-[14px] font-medium leading-6 text-muted-foreground">
            Drop a music folder here, or choose one from {folderPickerName}. Playhead will scan the
            folder and keep it updated.
          </p>
        </div>

        <div className="relative mt-6 grid w-full max-w-[360px] grid-cols-2 gap-2 rounded-[18px] bg-white/[0.045] p-1">
          {[
            { mode: "library" as const, label: "Library", description: "Artists and albums" },
            { mode: "folder" as const, label: "Folder", description: "Browse folders" },
          ].map((option) => (
            <button
              key={option.mode}
              type="button"
              className={`rounded-[14px] px-3 py-2 text-left transition ${
                libraryMode === option.mode
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
              }`}
              onClick={() => onLibraryModeChange(option.mode)}
            >
              <span className="block text-[13px] font-semibold leading-4">{option.label}</span>
              <span className="block text-[11px] font-medium leading-4 opacity-75">
                {option.description}
              </span>
            </button>
          ))}
        </div>

        <div className="relative mt-7 flex items-center gap-3">
          <motion.button
            className="no-drag flex h-[49px] items-center justify-center gap-2 rounded-[33px] bg-primary px-6 text-[14px] font-medium leading-none text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.48),0_14px_34px_rgba(255,255,0,0.08)] transition-colors disabled:opacity-55"
            title="Add folder"
            disabled={isScanning}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.985, y: 0 }}
            transition={{ type: "spring", stiffness: 520, damping: 34, mass: 0.7 }}
            onClick={onAddFolder}
          >
            <FolderPlusIcon size={17} strokeWidth={1.9} />
            {isScanning ? "Scanning..." : "Add Folder"}
          </motion.button>
        </div>
      </div>
    </motion.section>
  );
}
