import { motion } from "framer-motion";

export const DialogOverlay = motion.div;
export const DialogPanel = motion.section;
export const DialogForm = motion.form;

const easeOut = [0.22, 1, 0.36, 1] as const;

export const dialogOverlayMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.16, ease: easeOut },
};

export const dialogPanelMotion = {
  initial: {
    opacity: 0,
    y: 18,
    scale: 0.975,
    filter: "blur(10px)",
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
  },
  exit: {
    opacity: 0,
    y: 10,
    scale: 0.985,
    filter: "blur(8px)",
  },
  transition: {
    type: "spring",
    stiffness: 520,
    damping: 38,
    mass: 0.78,
    opacity: { duration: 0.14 },
    filter: { duration: 0.2 },
  },
} as const;
