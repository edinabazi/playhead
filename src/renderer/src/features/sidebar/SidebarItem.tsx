import type { MenuAnchorPoint } from "@/lib/menu-position";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

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
  onClick,
  onDropTrack,
  onContextMenu,
}: {
  active: boolean;
  icon: SidebarItemIcon;
  iconFilled?: boolean;
  label: string;
  detail: string;
  onClick: () => void;
  onDropTrack?: (trackIds: string[]) => void;
  onContextMenu?: (point: MenuAnchorPoint) => void;
}) {
  const [isDropTarget, setIsDropTarget] = useState(false);
  const acceptsTrackDrop = Boolean(onDropTrack);

  return (
    <motion.button
      layout="position"
      initial={{
        opacity: 0,
        y: -8,
        scale: 0.975,
        filter: "blur(6px)",
      }}
      animate={{
        opacity: 1,
        y: 0,
        scale: 1,
        filter: "blur(0px)",
      }}
      exit={{
        opacity: 0,
        y: -5,
        scale: 0.98,
        filter: "blur(5px)",
        transition: { duration: 0.14, ease: [0.4, 0, 1, 1] },
      }}
      transition={{
        layout: { type: "spring", stiffness: 520, damping: 34, mass: 0.7 },
        opacity: { duration: 0.16 },
        filter: { duration: 0.2 },
      }}
      className={`no-drag relative -mx-2 flex min-h-7 w-[calc(100%+16px)] items-center gap-2 overflow-hidden rounded-[8px] px-2 py-1 text-left text-[14px] font-medium leading-[1.35] transition-[background-color,color,transform] duration-150 ${
        isDropTarget || active
          ? "text-foreground"
          : "text-muted-foreground hover:bg-white/[0.045] hover:text-foreground"
      }`}
      onClick={onClick}
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
              trackIds = parsedTrackIds.filter((trackId): trackId is string => typeof trackId === "string");
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
      <AnimatePresence>
        {isDropTarget && (
          <motion.span
            className="pointer-events-none absolute inset-0 rounded-[8px] bg-primary/18 shadow-[inset_0_0_0_1px_rgba(255,255,0,0.55),0_0_24px_rgba(255,255,0,0.08)]"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
          />
        )}
        {!isDropTarget && active && (
          <motion.span
            className="pointer-events-none absolute inset-0 rounded-[8px] bg-white/[0.045]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
          />
        )}
      </AnimatePresence>
      <Icon
        className="relative z-10"
        size={17}
        strokeWidth={1.6}
        fill={iconFilled ? "currentColor" : "none"}
      />
      <span className="relative z-10 min-w-0 flex-1 truncate">{label}</span>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={detail}
          className="relative z-10 font-mono text-[11px] text-[var(--text-tertiary)]"
          initial={{ opacity: 0, y: -4, filter: "blur(3px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: 4, filter: "blur(3px)" }}
          transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
        >
          {detail}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}

export function SidebarEmpty({ children }: { children: React.ReactNode }) {
  return (
    <motion.p
      layout="position"
      initial={{ opacity: 0, y: -4, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, y: -4, filter: "blur(4px)" }}
      transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
      className="text-[14px] font-medium leading-[1.35] text-muted-foreground"
    >
      {children}
    </motion.p>
  );
}
