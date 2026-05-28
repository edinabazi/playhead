import { Tooltip } from "@/components/ui/tooltip";
import { useIcons } from "@/lib/icon-context";
import { panelSectionVariants } from "@/lib/motion-variants";
import { motion } from "framer-motion";
import { useState } from "react";

type SidebarIcon = React.ComponentType<{
  size?: number;
  strokeWidth?: number;
  className?: string;
}>;

export function SidebarGroup({
  title,
  collapsed,
  dragging,
  onToggleCollapsed,
  onDragStart,
  onDragOver,
  onDragEnd,
  actionLabel,
  actionIcon: ActionIcon,
  onAction,
  secondaryActions = [],
  children,
}: {
  title: string;
  collapsed: boolean;
  dragging?: boolean;
  onToggleCollapsed: () => void;
  onDragStart?: () => void;
  onDragOver?: () => void;
  onDragEnd?: () => void;
  actionLabel: string;
  actionIcon: SidebarIcon;
  onAction: () => void;
  secondaryActions?: Array<{
    label: string;
    icon: SidebarIcon;
    onClick: () => void;
  }>;
  children: React.ReactNode;
}) {
  const icons = useIcons();
  const ChevronIcon = icons["chevron-right"];
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.section
      layout="position"
      variants={panelSectionVariants}
      className={`no-drag flex flex-col gap-1 ${dragging ? "opacity-55" : ""}`}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
    >
      <motion.div
        layout="position"
        draggable
        className="-mx-1 flex min-h-6 cursor-grab items-center justify-between px-1 active:cursor-grabbing"
        onDragStartCapture={(event) => {
          event.dataTransfer.effectAllowed = "move";
          onDragStart?.();
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          onDragOver?.();
        }}
        onDragEndCapture={onDragEnd}
      >
        <button
          className="no-drag flex items-center gap-1 text-[13px] font-semibold leading-[1.35] text-[var(--text-tertiary)]"
          onClick={onToggleCollapsed}
        >
          <span>{title}</span>
          <ChevronIcon
            size={12}
            strokeWidth={1.7}
            className={`transition-transform ${collapsed ? "rotate-0" : "rotate-90"}`}
          />
        </button>
        <div
          className={`flex items-center gap-2 transition-opacity duration-150 ${
            isHovered ? "opacity-100" : "opacity-0"
          }`}
        >
          {secondaryActions.map((action) => {
            const Icon = action.icon;
            return (
              <Tooltip key={action.label} content={action.label} side="top" sideOffset={7}>
                <button
                  draggable={false}
                  className="no-drag text-muted-foreground hover:text-foreground"
                  aria-label={action.label}
                  onClick={action.onClick}
                >
                  <Icon size={15} strokeWidth={1.7} />
                </button>
              </Tooltip>
            );
          })}
          <Tooltip content={actionLabel} side="top" sideOffset={7}>
            <button
              draggable={false}
              className="no-drag text-muted-foreground hover:text-foreground"
              aria-label={actionLabel}
              onClick={onAction}
            >
              <ActionIcon size={15} strokeWidth={1.7} />
            </button>
          </Tooltip>
        </div>
      </motion.div>
      {!collapsed && <div className="-mx-2 flex flex-col gap-1 px-2">{children}</div>}
    </motion.section>
  );
}
