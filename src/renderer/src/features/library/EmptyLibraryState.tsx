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
  const LibraryIcon = icons["list-music"];
  const FolderIcon = icons["folder-open"];
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
      <div className="group relative grid w-full max-w-[610px] place-items-center overflow-hidden rounded-[38px] border border-white/[0.09] bg-[rgba(255,255,255,0.035)] px-8 py-10 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_30px_90px_rgba(0,0,0,0.2)] data-[dragging=true]:border-primary/60 data-[dragging=true]:bg-primary/[0.045]">
        <div className="pointer-events-none absolute inset-0 opacity-90">
          <div className="absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
          <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.035] blur-3xl" />
          <div className="absolute bottom-10 left-1/2 h-28 w-[420px] -translate-x-1/2 rounded-full bg-primary/[0.035] blur-3xl" />
        </div>

        <div className="relative grid size-[74px] place-items-center overflow-hidden rounded-[23px] shadow-[0_18px_48px_rgba(0,0,0,0.22)]">
          <img className="size-[74px]" src={playheadIcon} alt="" draggable={false} />
        </div>

        <div className="relative mt-4">
          <h2 className="text-[28px] font-semibold leading-none tracking-[-0.02em] text-foreground">
            Add your music
          </h2>
          <p className="mx-auto mt-3 max-w-[410px] text-[14px] font-medium leading-6 text-muted-foreground">
            Drop a folder here or choose one from {folderPickerName}. <br />
            Playhead will scan it and keep it updated.
          </p>
        </div>

        <div className="relative mt-6 grid w-full max-w-[420px] grid-cols-2 gap-1 rounded-full border border-white/10 bg-black/20 p-1">
          {[
            {
              mode: "library" as const,
              label: "Library",
              description: "Artists, albums, tracks",
              icon: LibraryIcon,
            },
            {
              mode: "folder" as const,
              label: "Folder",
              description: "Browse folders",
              icon: FolderIcon,
            },
          ].map((option) => {
            const OptionIcon = option.icon;

            return (
              <button
                key={option.mode}
                type="button"
                className={`flex min-h-12 items-center gap-2 rounded-full px-4 text-left transition ${
                  libraryMode === option.mode
                    ? "bg-primary text-primary-foreground shadow-[0_12px_34px_rgba(255,255,0,0.08)]"
                    : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
                }`}
                onClick={() => onLibraryModeChange(option.mode)}
              >
                <OptionIcon size={17} strokeWidth={1.9} className="shrink-0" />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold leading-4">
                    {option.label}
                  </span>
                  <span className="block truncate text-[11px] font-medium leading-4 opacity-72">
                    {option.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative mt-7 flex flex-col items-center gap-3">
          <motion.button
            className="no-drag flex h-[50px] items-center justify-center gap-2 rounded-full bg-foreground/10 px-7 text-[14px] font-semibold leading-none text-foreground transition-colors disabled:opacity-55"
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
