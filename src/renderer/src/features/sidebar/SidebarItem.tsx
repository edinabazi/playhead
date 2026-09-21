import { useIcons } from "@/lib/icon-context";
import type { MenuAnchorPoint } from "@/lib/menu-position";
import { useId, useState } from "react";

type SidebarItemIcon = React.ComponentType<{
  size?: number;
  strokeWidth?: number;
  className?: string;
  fill?: string;
}>;

export function SidebarItem({
  active,
  icon: Icon,
  iconFilled,
  label,
  detail,
  depth = 0,
  expanded,
  onToggleExpanded,
  onClick,
  onDropTrack,
  onContextMenu,
}: {
  active: boolean;
  icon: SidebarItemIcon;
  iconFilled?: boolean;
  label: string;
  detail?: React.ReactNode;
  depth?: number;
  expanded?: boolean;
  onToggleExpanded?: () => void;
  onClick: () => void;
  onDropTrack?: (trackIds: string[]) => void;
  onContextMenu?: (point: MenuAnchorPoint) => void;
}) {
  const labelId = useId();
  const detailId = useId();
  const hasDetail = detail !== undefined && detail !== null && detail !== "";
  const icons = useIcons();
  const ChevronIcon = icons["chevron-right"];
  const [isDropTarget, setIsDropTarget] = useState(false);
  const acceptsTrackDrop = Boolean(onDropTrack);

  return (
    <div
      className={`no-drag relative -mx-2 flex min-h-7 w-[calc(100%+16px)] items-center gap-2 overflow-hidden rounded-[8px] px-2 py-1 text-left text-[14px] font-medium leading-[1.35] transition-[background-color,color] duration-150 ${
        isDropTarget || active
          ? "text-foreground"
          : "text-muted-foreground hover:bg-white/[0.045] hover:text-foreground"
      }`}
      style={depth > 0 ? { paddingLeft: 8 + depth * 12 } : undefined}
      onContextMenu={(event) => {
        if (!onContextMenu) return;
        event.preventDefault();
        onContextMenu({ x: event.clientX, y: event.clientY });
      }}
      onDragOver={(event) => {
        if (!acceptsTrackDrop) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "move";
        setIsDropTarget(true);
      }}
      onDrop={(event) => {
        if (!onDropTrack) return;
        event.preventDefault();
        event.stopPropagation();
        const trackIdsPayload = event.dataTransfer.getData("application/x-playhead-track-ids");
        const fallbackTrackId = event.dataTransfer.getData("application/x-playhead-track-id");
        let trackIds = fallbackTrackId ? [fallbackTrackId] : [];

        if (trackIdsPayload) {
          try {
            const parsedTrackIds = JSON.parse(trackIdsPayload);
            if (Array.isArray(parsedTrackIds)) {
              trackIds = parsedTrackIds.filter(
                (trackId): trackId is string => typeof trackId === "string",
              );
            }
          } catch {
            trackIds = fallbackTrackId ? [fallbackTrackId] : [];
          }
        }

        if (trackIds.length > 0) onDropTrack(trackIds);
        setIsDropTarget(false);
      }}
      onDragEnter={(event) => {
        if (!acceptsTrackDrop) return;
        event.preventDefault();
        event.stopPropagation();
        setIsDropTarget(true);
      }}
      onDragLeave={(event) => {
        if (!acceptsTrackDrop) return;
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        setIsDropTarget(false);
      }}
    >
      {isDropTarget && (
        <span className="pointer-events-none absolute inset-0 rounded-[8px] bg-primary/18 shadow-[inset_0_0_0_1px_rgba(255,255,0,0.55),0_0_24px_rgba(255,255,0,0.08)]" />
      )}
      {!isDropTarget && active && (
        <span className="pointer-events-none absolute inset-0 rounded-[8px] bg-white/[0.045]" />
      )}
      <button
        type="button"
        aria-labelledby={labelId}
        aria-describedby={hasDetail ? detailId : undefined}
        onClick={onClick}
        className="absolute inset-0 rounded-[8px] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
      />
      <Icon
        className="pointer-events-none relative z-10"
        size={17}
        strokeWidth={1.6}
        fill={iconFilled ? "currentColor" : "none"}
      />
      <span className="pointer-events-none relative z-10 flex min-w-0 flex-1 items-center gap-1">
        <span id={labelId} className="min-w-0 truncate">
          {label}
        </span>
        {onToggleExpanded && (
          <button
            type="button"
            className="pointer-events-auto grid h-[18px] w-3 shrink-0 place-items-center rounded-sm text-[var(--text-tertiary)] hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
            aria-label={`${expanded ? "Collapse" : "Expand"} ${label}`}
            aria-expanded={Boolean(expanded)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") event.stopPropagation();
            }}
            onKeyUp={(event) => {
              if (event.key === "Enter" || event.key === " ") event.stopPropagation();
            }}
            onClick={(event) => {
              event.stopPropagation();
              onToggleExpanded();
            }}
          >
            <ChevronIcon
              size={12}
              strokeWidth={1.7}
              className={`transition-transform ${expanded ? "rotate-90" : "rotate-0"}`}
            />
          </button>
        )}
      </span>
      {hasDetail && (
        <span
          id={detailId}
          className="pointer-events-none relative z-10 font-mono text-[11px] text-[var(--text-tertiary)]"
        >
          {detail}
        </span>
      )}
    </div>
  );
}

export function SidebarEmpty({ children }: { children: React.ReactNode }) {
  return <p className="text-[14px] font-medium leading-[1.35] text-muted-foreground">{children}</p>;
}
