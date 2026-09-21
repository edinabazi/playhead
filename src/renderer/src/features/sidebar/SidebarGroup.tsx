import { Tooltip } from "@/components/ui/tooltip";
import { useIcons } from "@/lib/icon-context";
import { SidebarDisclosure } from "./SidebarDisclosure";
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
    <section
      className={`no-drag flex flex-col ${dragging ? "opacity-55" : ""}`}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
    >
      <div
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
          aria-expanded={!collapsed}
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
      </div>
      <SidebarDisclosure open={!collapsed}>{children}</SidebarDisclosure>
    </section>
  );
}
