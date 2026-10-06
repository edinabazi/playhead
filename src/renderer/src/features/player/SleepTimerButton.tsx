import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { DragRegionBlocker } from "@/components/ui/drag-region-blocker";
import { Dropdown, DropdownSeparator } from "@/components/ui/dropdown";
import { MenuItem } from "@/components/ui/menu-item";
import { useIcons } from "@/lib/icon-context";
import { IconButton } from "./IconButton";

export type SleepTimer = { kind: "minutes"; endsAt: number } | { kind: "end-of-track" } | null;

const minuteOptions = [15, 30, 45, 60, 90];

function remainingMinutes(timer: SleepTimer, now: number) {
  return timer?.kind === "minutes" ? Math.max(1, Math.ceil((timer.endsAt - now) / 60_000)) : 0;
}

export function SleepTimerButton({
  timer,
  onChange,
}: {
  timer: SleepTimer;
  onChange: (timer: SleepTimer) => void;
}) {
  const icons = useIcons();
  const MoonIcon = icons.moon;
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // The label shows whole minutes, so a coarse tick is enough.
  useEffect(() => {
    if (timer?.kind !== "minutes") return;
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(interval);
  }, [timer]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const label =
    timer?.kind === "minutes"
      ? `Sleep in ${remainingMinutes(timer, now)} min`
      : timer?.kind === "end-of-track"
        ? "Sleep after this track"
        : "Sleep timer";
  const choose = (next: SleepTimer) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className="relative flex shrink-0 items-center"
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <IconButton
        title="Sleep timer"
        tooltip={label}
        active={Boolean(timer)}
        ariaExpanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <MoonIcon size={18} strokeWidth={1.8} />
      </IconButton>
      {timer?.kind === "minutes" && (
        <span className="pointer-events-none -ml-1 text-[11px] font-medium tabular-nums text-primary">
          {remainingMinutes(timer, now)}m
        </span>
      )}
      {open && <DragRegionBlocker />}
      <AnimatePresence>
        {open && (
          <motion.div
            className="no-drag absolute bottom-full right-0 z-50 mb-2"
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 520, damping: 36, mass: 0.6 }}
          >
            <Dropdown className="w-52 bg-[rgba(10,10,10,0.96)]">
              {minuteOptions.map((minutes, index) => (
                <MenuItem
                  key={minutes}
                  icon={icons.clock}
                  label={`${minutes} minutes`}
                  index={index}
                  onSelect={() =>
                    choose({ kind: "minutes", endsAt: Date.now() + minutes * 60_000 })
                  }
                />
              ))}
              <MenuItem
                icon={icons["skip-forward"]}
                label="End of track"
                index={minuteOptions.length}
                checked={timer?.kind === "end-of-track"}
                onSelect={() => choose({ kind: "end-of-track" })}
              />
              {timer && (
                <>
                  <DropdownSeparator />
                  <MenuItem
                    icon={icons.x}
                    label="Turn off"
                    index={minuteOptions.length + 1}
                    onSelect={() => choose(null)}
                  />
                </>
              )}
            </Dropdown>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
