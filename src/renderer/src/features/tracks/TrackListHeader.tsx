import { useEffect, useRef, useState } from "react";
import { trackColumnIds, type TrackListSettings } from "../../../../shared/track-list";
import { trackColumns } from "./track-columns";

function stopPlaybackShortcut(event: React.KeyboardEvent) {
  if (event.key === "Enter" || event.key === " ") event.stopPropagation();
}

export function TrackListControls({
  settings,
  onChange,
}: {
  settings: TrackListSettings;
  onChange: (settings: TrackListSettings) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLInputElement>("input:not(:disabled)")?.focus();
    const close = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  return (
    <div
      className="no-drag flex h-8 shrink-0 items-center justify-end gap-3 text-[12px] text-muted-foreground"
      onKeyDown={stopPlaybackShortcut}
    >
      {settings.sort && (
        <button
          type="button"
          className="rounded px-2 py-1 hover:text-foreground focus-visible:outline focus-visible:outline-primary"
          onClick={() => onChange({ ...settings, sort: null })}
        >
          Reset sort
        </button>
      )}
      <div
        ref={containerRef}
        className="relative"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) {
            event.stopPropagation();
            setOpen(false);
            triggerRef.current?.focus();
          }
        }}
      >
        <button
          ref={triggerRef}
          type="button"
          aria-expanded={open}
          aria-controls="track-list-columns"
          className="rounded px-2 py-1 hover:text-foreground focus-visible:outline focus-visible:outline-primary"
          onClick={() => setOpen((value) => !value)}
        >
          Columns
        </button>
        {open && (
          <div
            ref={panelRef}
            id="track-list-columns"
            role="group"
            aria-label="Visible columns"
            className="absolute right-0 top-full z-40 mt-1 max-h-[min(420px,60vh)] w-48 overflow-y-auto rounded-xl border border-white/10 bg-[rgba(16,16,16,0.98)] p-2 shadow-xl"
          >
            {trackColumnIds.map((id) => (
              <label
                key={id}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-[13px] hover:bg-white/10"
              >
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={settings.columns.includes(id)}
                  disabled={id === "title"}
                  onChange={() => {
                    const columns = trackColumnIds.filter((column) =>
                      column === id
                        ? !settings.columns.includes(id)
                        : settings.columns.includes(column),
                    );
                    onChange({
                      columns,
                      sort:
                        settings.sort && columns.includes(settings.sort.column)
                          ? settings.sort
                          : null,
                    });
                  }}
                />
                {trackColumns[id].label}
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function TrackListHeader({
  settings,
  gridTemplateColumns,
  onChange,
}: {
  settings: TrackListSettings;
  gridTemplateColumns: string;
  onChange: (settings: TrackListSettings) => void;
}) {
  return (
    <div
      role="row"
      onKeyDown={stopPlaybackShortcut}
      className="mr-2 grid h-9 shrink-0 items-center gap-2 border-b border-white/10 px-[10px] text-[11px] font-medium text-muted-foreground"
      style={{ gridTemplateColumns }}
    >
      <span role="columnheader" aria-label="Source order">
        <button
          type="button"
          title="Restore source order"
          aria-label="Restore source order"
          className="w-full rounded focus-visible:outline focus-visible:outline-primary"
          onClick={() => onChange({ ...settings, sort: null })}
        >
          #
        </button>
      </span>
      {settings.columns.map((id) => {
        const column = trackColumns[id];
        const direction = settings.sort?.column === id ? settings.sort.direction : null;
        return (
          <div
            key={id}
            role="columnheader"
            aria-sort={
              direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none"
            }
          >
            <button
              type="button"
              aria-label={`Sort by ${column.label}`}
              className={`flex w-full items-center gap-1.5 rounded py-1 hover:text-foreground focus-visible:outline focus-visible:outline-primary ${column.numeric ? "justify-end" : ""} ${direction ? "text-foreground" : ""}`}
              onClick={() =>
                onChange({
                  ...settings,
                  sort: { column: id, direction: direction === "asc" ? "desc" : "asc" },
                })
              }
            >
              {column.label}
              <span aria-hidden="true">
                {direction === "asc" ? "↑" : direction === "desc" ? "↓" : ""}
              </span>
            </button>
          </div>
        );
      })}
      <span role="columnheader" aria-label="Track actions" />
    </div>
  );
}
