import type { Variants } from "framer-motion";

export const panelContentVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.045,
      delayChildren: 0.03,
    },
  },
};

export const panelSectionVariants: Variants = {
  hidden: { opacity: 0, y: 10, filter: "blur(8px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      type: "spring",
      stiffness: 520,
      damping: 38,
      mass: 0.76,
      opacity: { duration: 0.16 },
      filter: { duration: 0.18 },
    },
  },
};

export const panelItemVariants: Variants = {
  hidden: { opacity: 0, y: 8, scale: 0.985, filter: "blur(7px)" },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: {
      type: "spring",
      stiffness: 560,
      damping: 38,
      mass: 0.68,
      opacity: { duration: 0.14 },
      filter: { duration: 0.18 },
    },
  },
};
