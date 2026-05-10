import { motion, type Variants } from "framer-motion";

type IconButtonMotion = "default" | "previous" | "next" | "shuffle" | "repeat";

export function IconButton({
  title,
  disabled,
  active,
  motionType = "default",
  onClick,
  children,
}: {
  title: string;
  disabled?: boolean;
  active?: boolean;
  motionType?: IconButtonMotion;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const iconVariants = getIconVariants(motionType);

  return (
    <motion.button
      className={`no-drag relative grid size-9 place-items-center overflow-hidden rounded-full outline-none transition-colors duration-150 ${
        active ? "text-primary" : "text-muted-foreground hover:text-foreground"
      }`}
      title={title}
      onClick={onClick}
      disabled={disabled}
      initial="rest"
      animate={active ? "active" : "rest"}
      whileHover={disabled ? undefined : "hover"}
      whileTap={disabled ? undefined : "tap"}
      variants={buttonVariants}
      transition={buttonTransition}
    >
      <motion.span
        className="pointer-events-none absolute inset-0 rounded-full"
        variants={haloVariants}
        transition={buttonTransition}
      />
      <motion.span
        className="relative z-10 grid place-items-center"
        variants={iconVariants}
        transition={iconTransition}
      >
        {children}
      </motion.span>
    </motion.button>
  );
}

const buttonTransition = {
  type: "spring",
  stiffness: 520,
  damping: 30,
  mass: 0.62,
} as const;

const iconTransition = {
  type: "spring",
  stiffness: 680,
  damping: 24,
  mass: 0.5,
} as const;

const buttonVariants: Variants = {
  rest: { y: 0, scale: 1 },
  active: { y: 0, scale: 1 },
  hover: { y: -0.5, scale: 1.01 },
  tap: { y: 0, scale: 0.99 },
};

const haloVariants: Variants = {
  rest: {
    opacity: 0,
    scale: 0.95,
    background:
      "radial-gradient(circle at 50% 42%, rgba(255,255,255,0.12), rgba(255,255,255,0.025) 58%, rgba(255,255,255,0) 74%)",
    boxShadow: "0 0 0 rgba(255,255,255,0)",
  },
  active: {
    opacity: 1,
    scale: 1,
    background:
      "radial-gradient(circle at 50% 42%, rgba(255,255,0,0.18), rgba(255,255,0,0.045) 58%, rgba(255,255,255,0.018) 76%)",
    boxShadow: "0 0 26px rgba(255,255,0,0.08)",
  },
  hover: {
    opacity: 1,
    scale: 1,
    background:
      "radial-gradient(circle at 50% 42%, rgba(255,255,255,0.16), rgba(255,255,255,0.04) 58%, rgba(255,255,255,0) 76%)",
    boxShadow: "0 0 28px rgba(255,255,255,0.08)",
  },
  tap: {
    opacity: 0.8,
    scale: 0.95,
    boxShadow: "0 0 18px rgba(255,255,255,0.06)",
  },
};

function getIconVariants(motionType: IconButtonMotion): Variants {
  if (motionType === "previous") {
    return {
      rest: { x: 0, scale: 1, color: "currentColor" },
      active: { x: 0, scale: 1, color: "currentColor" },
      hover: { x: [-1, -4, -2], scale: 1.05, color: "currentColor" },
      tap: { x: -3, scale: 0.86, color: "currentColor" },
    };
  }

  if (motionType === "next") {
    return {
      rest: { x: 0, scale: 1, color: "currentColor" },
      active: { x: 0, scale: 1, color: "currentColor" },
      hover: { x: [1, 4, 2], scale: 1.05, color: "currentColor" },
      tap: { x: 3, scale: 0.86, color: "currentColor" },
    };
  }

  if (motionType === "shuffle") {
    return {
      rest: { rotate: 0, scale: 1, color: "currentColor" },
      active: { rotate: 0, scale: 1, color: "currentColor" },
      hover: { rotate: 0, scale: 1.05, color: "currentColor" },
      tap: { rotate: 0, scale: 0.84, color: "currentColor" },
    };
  }

  if (motionType === "repeat") {
    return {
      rest: { rotate: 0, scale: 1, color: "currentColor" },
      active: { rotate: 0, scale: 1, color: "currentColor" },
      hover: { rotate: 0, scale: 1.05, color: "currentColor" },
      tap: { rotate: 0, scale: 0.84, color: "currentColor" },
    };
  }

  return {
    rest: { scale: 1, color: "currentColor" },
    active: { scale: 1, color: "currentColor" },
    hover: { scale: 1.05, color: "currentColor" },
    tap: { scale: 0.95, color: "currentColor" },
  };
}
