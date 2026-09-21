import { MotionConfigContext, motion, useReducedMotion } from "framer-motion";
import { useContext, useState, type ReactNode } from "react";

/** Animate real height so the contents and following rows move as one surface. */
export function SidebarDisclosure({
  open,
  children,
}: {
  open: boolean;
  children: ReactNode | (() => ReactNode);
}) {
  const [retainContents, setRetainContents] = useState(open);
  // Keep rows for the closing transition, but never mount an unopened branch.
  if (open && !retainContents) setRetainContents(true);
  const { reducedMotion } = useContext(MotionConfigContext);
  const prefersReducedMotion = useReducedMotion();
  const reduceMotion =
    reducedMotion === "always" || (reducedMotion !== "never" && prefersReducedMotion);

  return (
    <motion.div
      initial={false}
      animate={{ height: open ? "auto" : 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.18, ease: [0.22, 1, 0.36, 1] }}
      onAnimationComplete={() => {
        if (!open) setRetainContents(false);
      }}
      className="-mx-2 overflow-hidden"
      aria-hidden={!open}
      inert={!open}
    >
      {(open || retainContents) && (
        <div className="flex flex-col gap-1 px-2 pt-1">
          {typeof children === "function" ? children() : children}
        </div>
      )}
    </motion.div>
  );
}
