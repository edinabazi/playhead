import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, useIsPresent } from "framer-motion";
import { Dropdown, DropdownLabel, DropdownSeparator } from "@/components/ui/dropdown";
import { MenuItem } from "@/components/ui/menu-item";
import { useIcons, type IconName } from "@/lib/icon-context";
import { springs } from "@/lib/springs";
import {
  defaultTrackListSettings,
  trackColumnIds,
  type TrackColumnId,
  type TrackListSettings,
} from "../../../../shared/track-list";
import { trackColumns } from "./track-columns";

export const columnIcons: Record<TrackColumnId, IconName> = {
  title: "music",
  artist: "user",
  album: "square-library",
  albumArtist: "users",
  genre: "tag",
  disc: "disc-3",
  trackNumber: "hash",
  year: "calendar-days",
  composer: "pencil",
  bpm: "gauge",
  duration: "clock",
};

export function getColumnMenuPosition(trigger: HTMLElement) {
  const rect = trigger.getBoundingClientRect();
  const margin = 12;
  const gap = 8;
  const below = window.innerHeight - rect.bottom - gap - margin;
  const above = rect.top - gap - margin;
  const openAbove = below < 280 && above > below;
  return {
    left: Math.max(margin, Math.min(rect.right - 248, window.innerWidth - 248 - margin)),
    top: openAbove ? undefined : rect.bottom + gap,
    bottom: openAbove ? window.innerHeight - rect.top + gap : undefined,
    maxHeight: Math.min(520, Math.max(160, openAbove ? above : below)),
    transformOrigin: openAbove ? "bottom right" : "top right",
  };
}

export function TrackListColumnMenu({
  id,
  settings,
  position,
  initialFocus,
  reduceMotion,
  trigger,
  onChange,
  onClose,
}: {
  id: string;
  settings: TrackListSettings;
  position: ReturnType<typeof getColumnMenuPosition>;
  initialFocus: "first" | "last" | null;
  reduceMotion: boolean;
  trigger: React.RefObject<HTMLButtonElement | null>;
  onChange: (settings: TrackListSettings) => void;
  onClose: (restoreFocus?: boolean) => void;
}) {
  const icons = useIcons();
  const panelRef = useRef<HTMLDivElement>(null);
  const isPresent = useIsPresent();

  useEffect(() => {
    if (initialFocus) {
      const items = panelRef.current?.querySelectorAll<HTMLElement>(
        '[role^="menuitem"]:not([aria-disabled="true"])',
      );
      (initialFocus === "last" ? items?.[items.length - 1] : items?.[0])?.focus();
    }
  }, [initialFocus]);

  useEffect(() => {
    if (!isPresent) return;
    const dismissOutside = (event: Event) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !trigger.current?.contains(target)) onClose();
    };
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("focusin", dismissOutside);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("focusin", dismissOutside);
    };
  }, [isPresent, onClose, trigger]);

  return createPortal(
    <motion.div
      ref={panelRef}
      className="no-drag fixed z-50"
      style={position}
      inert={!isPresent}
      aria-hidden={!isPresent || undefined}
      initial={{ opacity: 0, y: reduceMotion ? 0 : position.bottom === undefined ? -4 : 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduceMotion ? 0 : -2, transition: { duration: 0.1 } }}
      transition={{ ...springs.moderate, opacity: { duration: 0.12 } }}
      onKeyDown={(event) => {
        // Keep menu navigation and activation out of the player's global shortcuts.
        event.stopPropagation();
        if (event.key === "Escape") {
          event.preventDefault();
          onClose(true);
        } else if (event.key === "Tab") {
          // Let the browser continue from the trigger in the normal tab order.
          onClose(true);
        }
      }}
    >
      <Dropdown
        id={id}
        aria-label="Visible columns"
        className="thin-scrollbar w-[248px] overflow-y-auto [&>*]:shrink-0 bg-[rgba(10,10,10,0.96)] shadow-[0_12px_40px_rgba(0,0,0,0.4)]"
        style={{ maxHeight: position.maxHeight }}
      >
        <DropdownLabel className="flex items-center justify-between px-2 pb-2 pt-2">
          <span>Show columns</span>
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground/60">
            {settings.columns.length} visible
          </span>
        </DropdownLabel>
        {trackColumnIds.map((id, index) => (
          <MenuItem
            key={id}
            role="menuitemcheckbox"
            icon={icons[columnIcons[id]]}
            label={trackColumns[id].label}
            index={index}
            checked={settings.columns.includes(id)}
            aria-disabled={id === "title" || undefined}
            title={id === "title" ? "Title is always shown" : undefined}
            tabIndex={index === 1 ? 0 : -1}
            className={id === "title" ? "cursor-default opacity-40" : "cursor-pointer"}
            onSelect={() => {
              if (id === "title") return;
              const columns = trackColumnIds.filter((column) =>
                column === id ? !settings.columns.includes(id) : settings.columns.includes(column),
              );
              onChange({
                columns,
                sort:
                  settings.sort && columns.includes(settings.sort.column) ? settings.sort : null,
              });
            }}
          />
        ))}
        <DropdownSeparator />
        {settings.sort && (
          <MenuItem
            role="menuitem"
            aria-checked={undefined}
            icon={icons["list-music"]}
            label="Reset sort"
            index={trackColumnIds.length + 1}
            className="cursor-pointer"
            onSelect={() => {
              onChange({ ...settings, sort: null });
              onClose(true);
            }}
          />
        )}
        <MenuItem
          role="menuitem"
          aria-checked={undefined}
          icon={icons["rotate-ccw"]}
          label="Reset columns"
          index={trackColumnIds.length}
          className="cursor-pointer"
          onSelect={() => {
            const columns = defaultTrackListSettings().columns;
            onChange({
              columns,
              sort: settings.sort && columns.includes(settings.sort.column) ? settings.sort : null,
            });
          }}
        />
      </Dropdown>
    </motion.div>,
    document.body,
  );
}
