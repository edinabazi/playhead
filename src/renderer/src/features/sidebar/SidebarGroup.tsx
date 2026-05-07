import { useIcons } from "@/lib/icon-context";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

type SidebarIcon = React.ComponentType<{
  size?: number;
  strokeWidth?: number;
  className?: string;
}>;

export function SidebarGroup({
  title,
  collapsed,
  onToggleCollapsed,
  actionLabel,
  actionIcon: ActionIcon,
  onAction,
  secondaryActions = [],
  children,
}: {
  title: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
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
    <section
      className="no-drag flex flex-col gap-1"
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
    >
      <div className="-mx-1 flex min-h-6 items-center justify-between px-1">
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
              <button
                key={action.label}
                className="no-drag text-muted-foreground hover:text-foreground"
                title={action.label}
                onClick={action.onClick}
              >
                <Icon size={15} strokeWidth={1.7} />
              </button>
            );
          })}
          <button
            className="no-drag text-muted-foreground hover:text-foreground"
            title={actionLabel}
            onClick={onAction}
          >
            <ActionIcon size={15} strokeWidth={1.7} />
          </button>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            className="-mx-2 flex flex-col gap-1 overflow-hidden px-2"
            initial={{ height: 0, opacity: 0, y: -4 }}
            animate={{ height: "auto", opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -4 }}
            transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.8 }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
