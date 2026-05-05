import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  DialogForm,
  DialogOverlay,
  dialogOverlayMotion,
  dialogPanelMotion,
} from "@/components/ui/dialog-motion";
import { useIcons } from "@/lib/icon-context";

export function CreatePlaylistDialog({
  title = "Create Playlist",
  description = "Name the playlist before adding it to Playhead.",
  initialName = "",
  submitLabel = "Create",
  onCreate,
  onClose,
}: {
  title?: string;
  description?: string;
  initialName?: string;
  submitLabel?: string;
  onCreate: (name: string) => void;
  onClose: () => void;
}) {
  const icons = useIcons();
  const [name, setName] = useState(initialName);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const submit = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    onCreate(trimmedName);
  };

  return createPortal(
    <DialogOverlay
      {...dialogOverlayMotion}
      className="no-drag fixed inset-0 z-[10000] grid place-items-center bg-black/40 px-5"
      onPointerDown={onClose}
    >
      <DialogForm
        {...dialogPanelMotion}
        className="w-full max-w-[360px] rounded-[28px] border border-white/10 bg-[rgba(10,10,10,0.96)] p-3 shadow-2xl"
        onPointerDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="flex items-start justify-between gap-3 px-2 pt-1">
          <div>
            <h2 className="text-[15px] font-semibold leading-6 text-foreground">
              {title}
            </h2>
            <p className="mt-1 text-[13px] font-medium leading-5 text-muted-foreground">
              {description}
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

        <div className="mt-4 px-2">
          <input
            ref={inputRef}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-10 w-full rounded-[18px] border border-white/10 bg-white/[0.055] px-3 text-[14px] font-medium text-foreground outline-none transition focus:border-primary/70"
            placeholder="Playlist name"
          />
        </div>

        <div className="mt-4 flex justify-end gap-2 px-2 pb-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!name.trim()}>
            {submitLabel}
          </Button>
        </div>
      </DialogForm>
    </DialogOverlay>,
    document.body,
  );
}
