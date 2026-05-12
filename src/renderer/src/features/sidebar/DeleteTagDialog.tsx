import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  DialogOverlay,
  DialogPanel,
  dialogOverlayMotion,
  dialogPanelMotion,
} from "@/components/ui/dialog-motion";
import { useIcons } from "@/lib/icon-context";
import type { LibraryTag } from "../../../../shared/library";

export function DeleteTagDialog({
  tag,
  onConfirm,
  onClose,
}: {
  tag: LibraryTag;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const icons = useIcons();

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
        className="w-full max-w-[380px] rounded-[28px] border border-white/10 bg-[rgba(10,10,10,0.96)] p-3 shadow-2xl"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-2 pt-1">
          <div>
            <h2 className="text-[15px] font-semibold leading-6 text-foreground">
              Delete {tag.name}?
            </h2>
            <p className="mt-1 text-[13px] font-medium leading-5 text-muted-foreground">
              This removes the tag from Playhead. Your music files will stay where they are.
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

        <div className="mt-4 flex justify-end gap-2 px-2 pb-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-red-500 text-white hover:bg-red-400 active:bg-red-600"
            onClick={onConfirm}
          >
            Delete Tag
          </Button>
        </div>
      </DialogPanel>
    </DialogOverlay>,
    document.body,
  );
}
