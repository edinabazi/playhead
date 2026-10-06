import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  DialogOverlay,
  DialogPanel,
  dialogOverlayMotion,
  dialogPanelMotion,
} from "@/components/ui/dialog-motion";
import { formatTime } from "@/lib/format";
import { useIcons } from "@/lib/icon-context";
import { getNativeFileManagerName } from "@/lib/menu-position";
import type { LibraryTrack } from "../../../../shared/library";
import { findDuplicateGroups } from "./duplicates";

/** Read-only list of likely duplicates; removing files stays with the user. */
export function DuplicatesDialog({
  tracks,
  onPlay,
  onShowInFolder,
  onClose,
}: {
  tracks: LibraryTrack[];
  onPlay: (track: LibraryTrack) => void;
  onShowInFolder: (track: LibraryTrack) => void;
  onClose: () => void;
}) {
  const icons = useIcons();
  const FolderIcon = icons["folder-search"];
  const groups = useMemo(() => findDuplicateGroups(tracks), [tracks]);
  const copies = groups.reduce((sum, group) => sum + group.length - 1, 0);
  const fileManagerName = getNativeFileManagerName();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return createPortal(
    <DialogOverlay
      {...dialogOverlayMotion}
      className="app-modal-overlay no-drag fixed inset-0 z-[10000] grid place-items-center bg-black/40 px-5"
      onPointerDown={onClose}
    >
      <DialogPanel
        {...dialogPanelMotion}
        className="selectable flex max-h-[80vh] w-full max-w-[640px] flex-col rounded-[28px] border border-white/10 bg-[rgba(10,10,10,0.96)] p-3 shadow-2xl"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-2 pt-1">
          <div>
            <h2 className="text-[15px] font-semibold leading-6 text-foreground">
              Duplicate tracks
            </h2>
            <p className="mt-1 text-[13px] font-medium leading-5 text-muted-foreground">
              {groups.length === 0
                ? "No duplicates found. Tracks match when artist, title and length agree."
                : `${groups.length} ${groups.length === 1 ? "track has" : "tracks have"} copies (${copies} extra ${copies === 1 ? "file" : "files"}). Nothing is deleted; remove copies in ${fileManagerName}.`}
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

        <div className="thin-scrollbar mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto px-2 pb-1">
          {groups.map((group) => (
            <div
              key={group.map((track) => track.id).join("|")}
              className="rounded-[18px] border border-white/10 bg-white/[0.035] p-3"
            >
              <div className="text-[13px] font-semibold text-foreground">
                {group[0].artist} — {group[0].title}
              </div>
              <div className="mt-2 space-y-1">
                {group.map((track) => (
                  <div key={track.id} className="flex items-center gap-2 text-[12px]">
                    <span
                      className="min-w-0 flex-1 truncate font-mono text-muted-foreground"
                      title={track.path}
                    >
                      {track.path}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {[track.audioFormat, formatTime(track.duration)].filter(Boolean).join(" · ")}
                    </span>
                    <button
                      type="button"
                      aria-label={`Play ${track.path}`}
                      className="grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-foreground"
                      onClick={() => onPlay(track)}
                    >
                      <icons.play size={12} strokeWidth={2} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Show in ${fileManagerName}`}
                      title={`Show in ${fileManagerName}`}
                      className="grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-foreground"
                      onClick={() => onShowInFolder(track)}
                    >
                      <FolderIcon size={12} strokeWidth={2} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogPanel>
    </DialogOverlay>,
    document.body,
  );
}
