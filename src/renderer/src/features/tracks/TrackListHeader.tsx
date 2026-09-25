import { useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, MotionConfigContext, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { useIcons } from "@/lib/icon-context";
import type {
  TrackListSettings,
  TrackColumnWidths,
  TrackColumnId,
} from "../../../../shared/track-list";
import { ColumnResizeHandle } from "./ColumnResizeHandle";
import { trackColumns } from "./track-columns";
import { getColumnMenuPosition, TrackListColumnMenu } from "./TrackListColumnMenu";

function stopPlaybackShortcut(event: React.KeyboardEvent) {
  if (event.key === "Enter" || event.key === " ") event.stopPropagation();
}

export function TrackListHeader({
  settings,
  gridTemplateColumns,
  onChange,
  onPreviewWidths,
}: {
  onPreviewWidths?: (widths: TrackColumnWidths | null) => void;
  settings: TrackListSettings;
  gridTemplateColumns: string;
  onChange: (settings: TrackListSettings) => void;
}) {
  const headerRef = useRef<HTMLDivElement>(null);
  const resizedWidths = (id: TrackColumnId, width: number) => {
    const widths = { ...settings.widths, [id]: width };
    // Freeze the flexible title so other dividers follow the pointer directly.
    if (id !== "title" && widths.title === undefined) {
      const title = headerRef.current?.querySelector('[aria-label="Sort by Title"]');
      if (title) widths.title = Math.round(title.getBoundingClientRect().width);
    }
    return widths;
  };
  const icons = useIcons();
  const ColumnsIcon = icons["columns-3"];
  const OrderIcon = icons.hash;
  const AscendingIcon = icons["arrow-up"];
  const DescendingIcon = icons["arrow-down"];
  const UnsortedIcon = icons["arrow-up-down"];
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const [menu, setMenu] = useState<{
    position: ReturnType<typeof getColumnMenuPosition>;
    initialFocus: "first" | "last" | null;
  } | null>(null);
  const systemReduceMotion = useReducedMotion();
  const motionConfig = useContext(MotionConfigContext);
  const reduceMotion =
    motionConfig.reducedMotion === "always" ||
    (motionConfig.reducedMotion !== "never" && Boolean(systemReduceMotion));
  const closeMenu = useCallback((restoreFocus = false) => {
    setMenu(null);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);
  const openMenu = (initialFocus: "first" | "last" | null = null) => {
    if (triggerRef.current)
      setMenu({ position: getColumnMenuPosition(triggerRef.current), initialFocus });
  };
  const open = Boolean(menu);

  useEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      if (triggerRef.current) {
        const position = getColumnMenuPosition(triggerRef.current);
        setMenu((current) => (current ? { ...current, position } : null));
      }
    };
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, [open]);

  return (
    <div
      ref={headerRef}
      role="row"
      onKeyDown={stopPlaybackShortcut}
      onContextMenu={(event) => {
        event.preventDefault();
        openMenu("first");
      }}
      className="no-drag mr-2 grid h-9 shrink-0 items-center gap-2 border-b border-white/[0.08] px-[10px] text-[11px] font-medium text-muted-foreground"
      style={{ gridTemplateColumns }}
    >
      <span role="columnheader" aria-label="Source order">
        <Tooltip content="Restore source order">
          <button
            type="button"
            aria-label="Restore source order"
            className="grid h-7 w-full place-items-center rounded-md transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-primary"
            onClick={() => onChange({ ...settings, sort: null })}
          >
            <OrderIcon size={12} strokeWidth={1.6} />
          </button>
        </Tooltip>
      </span>
      {settings.columns.map((id) => {
        const column = trackColumns[id];
        const direction = settings.sort?.column === id ? settings.sort.direction : null;
        const SortIcon =
          direction === "asc"
            ? AscendingIcon
            : direction === "desc"
              ? DescendingIcon
              : UnsortedIcon;
        return (
          <div
            key={id}
            role="columnheader"
            aria-label={column.label}
            className="relative min-w-0"
            aria-sort={
              direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none"
            }
          >
            <button
              type="button"
              aria-label={`Sort by ${column.label}`}
              title={`Sort by ${column.label}, ${direction === "asc" ? "descending" : "ascending"}`}
              className={`group flex h-7 w-full items-center gap-1 rounded-md transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-primary ${column.numeric ? "justify-end" : ""} ${direction ? "text-foreground" : ""}`}
              onClick={() =>
                onChange({
                  ...settings,
                  sort: { column: id, direction: direction === "asc" ? "desc" : "asc" },
                })
              }
            >
              <span className="truncate">{column.label}</span>
              <span
                aria-hidden="true"
                className={`shrink-0 transition-opacity duration-150 ${direction ? "text-primary opacity-100" : "opacity-0 group-hover:opacity-60 group-focus-visible:opacity-60"}`}
              >
                <SortIcon size={12} strokeWidth={1.8} />
              </span>
            </button>
            <ColumnResizeHandle
              id={id}
              label={column.label}
              width={settings.widths?.[id] ?? column.width}
              onPreview={(width) =>
                onPreviewWidths?.(width === null ? null : resizedWidths(id, width))
              }
              onCommit={(width) => {
                const widths =
                  width === undefined ? { ...settings.widths } : resizedWidths(id, width);
                if (width === undefined) delete widths[id];
                else widths[id] = width;
                onChange({ ...settings, widths });
              }}
            />
          </div>
        );
      })}
      <span
        role="columnheader"
        aria-label="Track actions"
        className="sticky right-0 flex justify-end"
      >
        <Tooltip content="Choose columns">
          <Button
            ref={triggerRef}
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Choose columns"
            aria-haspopup="menu"
            aria-expanded={open}
            aria-controls={open ? menuId : undefined}
            className={`!h-7 !w-7 focus-visible:ring-2 focus-visible:ring-primary/70 ${open ? "bg-white/[0.08] text-foreground" : ""}`}
            onClick={(event) =>
              open ? closeMenu() : openMenu(event.detail === 0 ? "first" : null)
            }
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                event.stopPropagation();
                openMenu(event.key === "ArrowUp" ? "last" : "first");
              } else if (event.key === "Escape" && open) {
                event.preventDefault();
                event.stopPropagation();
                closeMenu(true);
              }
            }}
          >
            <ColumnsIcon size={14} strokeWidth={1.5} />
          </Button>
        </Tooltip>
      </span>
      <AnimatePresence>
        {menu && (
          <TrackListColumnMenu
            key="columns"
            id={menuId}
            settings={settings}
            position={menu.position}
            initialFocus={menu.initialFocus}
            reduceMotion={reduceMotion}
            trigger={triggerRef}
            onChange={onChange}
            onClose={closeMenu}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
