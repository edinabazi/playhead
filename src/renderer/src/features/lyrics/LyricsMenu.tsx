import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { Dropdown } from "@/components/ui/dropdown";
import { MenuItem } from "@/components/ui/menu-item";
import { useIcons } from "@/lib/icon-context";

export function LyricsMenu({
  custom,
  disabled,
  reduceMotion,
  onChoose,
  onRefresh,
  onAutomatic,
}: {
  custom: boolean;
  disabled: boolean;
  reduceMotion: boolean;
  onChoose: () => void;
  onRefresh: () => void;
  onAutomatic: () => void;
}) {
  const icons = useIcons();
  const More = icons.ellipsis;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    ref.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const outside = (event: Event) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
    };
  }, [open]);
  const action = (fn: () => void) => {
    setOpen(false);
    trigger.current?.focus();
    fn();
  };
  return (
    <div
      ref={ref}
      className="relative"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
        }
        if (event.key === "Tab" && open) {
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <Tooltip content="Lyrics options">
        <Button
          ref={trigger}
          variant="ghost"
          size="icon-sm"
          aria-label="Lyrics options"
          aria-haspopup="menu"
          aria-expanded={open}
          disabled={disabled}
          onClick={() => setOpen(!open)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
            }
          }}
        >
          <More size={16} />
        </Button>
      </Tooltip>
      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute right-0 top-full z-50 mt-1 w-[224px]"
            initial={{ opacity: 0, y: reduceMotion ? 0 : -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.12 }}
          >
            <Dropdown aria-label="Lyrics options" className="bg-[rgba(10,10,10,0.96)] shadow-xl">
              <MenuItem
                role="menuitem"
                aria-checked={undefined}
                icon={icons["folder-open"]}
                index={0}
                label="Choose lyrics file…"
                onSelect={() => action(onChoose)}
              />
              <MenuItem
                role="menuitem"
                aria-checked={undefined}
                icon={icons["rotate-ccw"]}
                index={1}
                label="Reload lyrics"
                onSelect={() => action(onRefresh)}
              />
              {custom && (
                <MenuItem
                  role="menuitem"
                  aria-checked={undefined}
                  icon={icons.music}
                  index={2}
                  label="Use automatic lyrics"
                  onSelect={() => action(onAutomatic)}
                />
              )}
            </Dropdown>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
