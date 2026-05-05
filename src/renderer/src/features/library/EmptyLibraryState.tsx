import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useIcons } from "@/lib/icon-context";

export function EmptyLibraryState({
  isScanning,
  onAddFolder,
  onDropFolderPath,
}: {
  isScanning: boolean;
  onAddFolder: () => void;
  onDropFolderPath: (folderPath: string) => void;
}) {
  const icons = useIcons();
  const FolderPlusIcon = icons["folder-plus"];
  const MusicIcon = icons.music;

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
          <div className="absolute inset-x-12 top-1/2 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
          <motion.div
            className="absolute top-0 h-full w-24 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent"
            initial={{ x: "-120%" }}
            animate={{ x: "640%" }}
            transition={{ duration: 2.2, ease: "linear", repeat: Infinity }}
          />
        </div>

        <motion.div
          className="relative grid size-20 place-items-center rounded-[24px] border border-white/[0.08] bg-black/35 text-foreground shadow-[0_18px_60px_rgba(0,0,0,0.24)]"
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 2.4, ease: "easeInOut", repeat: Infinity }}
        >
          <MusicIcon size={30} strokeWidth={1.7} />
        </motion.div>

        <div className="relative mt-7">
          <h2 className="text-[22px] font-semibold leading-tight text-foreground">
            Build your library
          </h2>
          <p className="mx-auto mt-3 max-w-[360px] text-[14px] font-medium leading-6 text-muted-foreground">
            Drop a music folder here, or choose one from Finder. Playhead will scan the folder and
            keep it updated.
          </p>
        </div>

        <div className="relative mt-7 flex items-center gap-3">
          <Button leadingIcon={FolderPlusIcon} disabled={isScanning} onClick={onAddFolder}>
            {isScanning ? "Scanning..." : "Select Folder"}
          </Button>
        </div>
      </div>
    </motion.section>
  );
}
