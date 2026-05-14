import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Tooltip } from "@/components/ui/tooltip";
import { useIcons } from "@/lib/icon-context";

export function FavoriteHeartButton({
  active,
  disabled,
  tooltipSide = "top",
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  tooltipSide?: "top" | "left";
  onClick: React.MouseEventHandler<HTMLButtonElement>;
}) {
  const icons = useIcons();
  const reduceMotion = useReducedMotion();
  const HeartIcon = icons.heart;
  const label = active ? "Remove from Loved" : "Add to Loved";
  const sparks = [
    { x: 0, y: -29, size: 5 },
    { x: 24, y: -17, size: 4 },
    { x: 25, y: 9, size: 3 },
    { x: 0, y: 27, size: 4 },
    { x: -25, y: 9, size: 5 },
    { x: -24, y: -17, size: 3 },
  ];

  return (
    <Tooltip content={label} side={tooltipSide}>
      <button
        className={`no-drag relative grid size-7 place-items-center transition hover:text-foreground disabled:opacity-40 ${
          active ? "text-primary" : "text-muted-foreground"
        }`}
        title={label}
        disabled={disabled}
        onClick={onClick}
      >
        <AnimatePresence>
          {active && !reduceMotion && (
            <motion.span
              key="favorite-burst"
              className="pointer-events-none absolute inset-0 rounded-full border border-primary/70"
              initial={{ opacity: 0.58, scale: 0.45 }}
              animate={{ opacity: 0, scale: 2.05 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.58, ease: [0.18, 0.9, 0.26, 1] }}
            />
          )}
        </AnimatePresence>
        <motion.span
          className="relative grid place-items-center"
          animate={
            reduceMotion
              ? { scale: 1 }
              : active
                ? { scale: [1, 0.88, 1.2, 0.98, 1.04, 1] }
                : { scale: [1, 0.9, 1] }
          }
          transition={{ duration: active ? 0.62 : 0.24, ease: [0.18, 0.9, 0.26, 1] }}
        >
          <HeartIcon size={18} strokeWidth={1.7} fill={active ? "currentColor" : "none"} />
        </motion.span>
        <AnimatePresence>
          {active && !reduceMotion && (
            <motion.span
              key="favorite-sparks"
              className="pointer-events-none absolute inset-0"
              initial="initial"
              animate="animate"
              exit="exit"
            >
              {sparks.map((spark, index) => (
                <motion.span
                  key={index}
                  className="absolute left-1/2 top-1/2 rounded-full bg-primary shadow-[0_0_8px_rgba(255,255,0,0.48)]"
                  style={{ width: spark.size, height: spark.size }}
                  variants={{
                    initial: { opacity: 0, x: "-50%", y: "-50%", scale: 0.45 },
                    animate: {
                      opacity: [0, 0.95, 0],
                      x: ["-50%", `calc(-50% + ${spark.x}px)`],
                      y: ["-50%", `calc(-50% + ${spark.y}px)`],
                      scale: [0.45, 1.08, 0.2],
                    },
                    exit: { opacity: 0 },
                  }}
                  transition={{ duration: 0.6, ease: [0.18, 0.9, 0.26, 1] }}
                />
              ))}
            </motion.span>
          )}
        </AnimatePresence>
      </button>
    </Tooltip>
  );
}
