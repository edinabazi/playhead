import { useEffect } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  DialogOverlay,
  DialogPanel,
  dialogOverlayMotion,
  dialogPanelMotion,
} from "@/components/ui/dialog-motion";
import { useIcons } from "@/lib/icon-context";

export type UpdateMessage = {
  title: string;
  description: ReactNode;
  buttonLabel: string;
};

export function UpdateMessageDialog({
  message,
  onClose,
}: {
  message: UpdateMessage;
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
        className="flex max-h-[min(80vh,680px)] w-full max-w-[460px] flex-col rounded-[28px] border border-white/10 bg-[rgba(10,10,10,0.96)] p-3 shadow-2xl"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 px-2 pt-1">
          <h2 className="min-w-0 text-base font-semibold leading-6 text-foreground">
            {message.title}
          </h2>
          <button
            type="button"
            className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
            title="Close"
            onClick={onClose}
          >
            <icons.x size={16} strokeWidth={1.8} />
          </button>
        </div>

        {/* Long release notes scroll; the title and button stay in view. */}
        <div className="thin-scrollbar mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto px-2 text-[13px] font-medium leading-5 text-muted-foreground [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4 [&_h3]:mb-1 [&_h3]:mt-4 [&_h3]:text-[13px] [&_h3]:font-semibold [&_h3]:text-foreground [&_h3:first-child]:mt-0 [&_li]:mb-2 [&_li]:pl-1 [&_ol]:ml-4 [&_ol]:list-decimal [&_p]:m-0 [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:ml-4 [&_ul]:list-disc">
          {message.description}
        </div>

        <div className="mt-6 flex shrink-0 justify-end px-2 pb-1">
          <Button type="button" onClick={onClose}>
            {message.buttonLabel}
          </Button>
        </div>
      </DialogPanel>
    </DialogOverlay>,
    document.body,
  );
}
