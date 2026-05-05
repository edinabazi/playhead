import type { MenuAnchorPoint } from "@/lib/menu-position";
import { AnimatePresence, motion } from "framer-motion";

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
  onDropTrack?: (trackId: string) => void;
  onContextMenu?: (point: MenuAnchorPoint) => void;
}) {
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
      className={`no-drag flex min-h-7 items-center gap-2 rounded-[14px] px-0 py-1 text-left text-[14px] font-medium leading-[1.35] transition-colors duration-150 ${
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
      onClick={onClick}
      onContextMenu={(event) => {
        if (!onContextMenu) return;
        event.preventDefault();
        onContextMenu({ x: event.clientX, y: event.clientY });
      }}
      onDragOver={(event) => {
        if (!onDropTrack) return;
        event.preventDefault();
      }}
      onDrop={(event) => {
        if (!onDropTrack) return;
        const trackId = event.dataTransfer.getData("application/x-playhead-track-id");
        if (trackId) onDropTrack(trackId);
      }}
    >
      <Icon size={17} strokeWidth={1.6} fill={iconFilled ? "currentColor" : "none"} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={detail}
          className="font-mono text-[11px] text-[var(--text-tertiary)]"
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

