import { Switch } from "@/components/ui/switch";
import { AnimatePresence, motion } from "framer-motion";

export function SoundPanel({
  open,
  volumeBoostEnabled,
  onVolumeBoostChange,
}: {
  open: boolean;
  volumeBoostEnabled: boolean;
  onVolumeBoostChange: (enabled: boolean) => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="no-drag absolute left-0 top-full z-50 mt-2 w-[min(470px,calc(100vw-340px))] rounded-[22px] border border-white/10 bg-[rgba(10,10,10,0.96)] p-4 shadow-[0_24px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl"
          initial={{ opacity: 0, y: -6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 520, damping: 36, mass: 0.6 }}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <h4 className="text-[14px] font-semibold leading-5 text-foreground">Volume boost</h4>
              <p className="mt-1 text-[12px] font-medium leading-4 text-muted-foreground">
                Lets volume go up to 200%. A limiter keeps it clean.
              </p>
            </div>
            <Switch
              checked={volumeBoostEnabled}
              aria-label="Volume boost"
              onCheckedChange={onVolumeBoostChange}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
