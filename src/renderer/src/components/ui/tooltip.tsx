import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

type TooltipSide = "top" | "right" | "bottom" | "left";
type TooltipTriggerProps = {
  "aria-describedby"?: string;
  onBlur?: (event: React.FocusEvent) => void;
  onFocus?: (event: React.FocusEvent) => void;
  onMouseEnter?: (event: React.MouseEvent) => void;
  onMouseLeave?: (event: React.MouseEvent) => void;
};

function getTooltipPosition(rect: DOMRect, side: TooltipSide, offset: number) {
  if (side === "top") {
    return {
      left: rect.left + rect.width / 2,
      top: rect.top - offset,
      x: "-50%",
      y: "-100%",
    };
  }
  if (side === "bottom") {
    return {
      left: rect.left + rect.width / 2,
      top: rect.bottom + offset,
      x: "-50%",
      y: "0",
    };
  }
  if (side === "right") {
    return {
      left: rect.right + offset,
      top: rect.top + rect.height / 2,
      x: "0",
      y: "-50%",
    };
  }
  return {
    left: rect.left - offset,
    top: rect.top + rect.height / 2,
    x: "-100%",
    y: "-50%",
  };
}

export function Tooltip({
  content,
  children,
  side = "top",
  sideOffset = 8,
  delayDuration = 200,
  className,
}: {
  content: ReactNode;
  children: ReactElement;
  side?: TooltipSide;
  sideOffset?: number;
  delayDuration?: number;
  className?: string;
}) {
  const tooltipId = useId();
  const delayRef = useRef<number | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<ReturnType<typeof getTooltipPosition> | null>(null);

  const clearDelay = () => {
    if (delayRef.current === null) return;
    window.clearTimeout(delayRef.current);
    delayRef.current = null;
  };

  const show = () => {
    clearDelay();
    delayRef.current = window.setTimeout(() => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) setPosition(getTooltipPosition(rect, side, sideOffset));
      setOpen(true);
    }, delayDuration);
  };

  const hide = () => {
    clearDelay();
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) setPosition(getTooltipPosition(rect, side, sideOffset));
    };

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, side, sideOffset]);

  if (!isValidElement(children)) return null;

  const child = children as ReactElement<TooltipTriggerProps> & { ref?: React.Ref<HTMLElement> };
  const trigger = cloneElement(child as ReactElement<Record<string, unknown>>, {
    "aria-describedby": open ? tooltipId : undefined,
    ref: (node: HTMLElement | null) => {
      triggerRef.current = node;
      const childRef = child.ref;
      if (typeof childRef === "function") childRef(node);
      else if (childRef && "current" in childRef) {
        (childRef as React.MutableRefObject<HTMLElement | null>).current = node;
      }
    },
    onBlur: (event: React.FocusEvent) => {
      child.props.onBlur?.(event);
      hide();
    },
    onFocus: (event: React.FocusEvent) => {
      child.props.onFocus?.(event);
      show();
    },
    onMouseEnter: (event: React.MouseEvent) => {
      child.props.onMouseEnter?.(event);
      show();
    },
    onMouseLeave: (event: React.MouseEvent) => {
      child.props.onMouseLeave?.(event);
      hide();
    },
  });

  return (
    <>
      {trigger}
      {createPortal(
        <AnimatePresence>
          {open && position && (
            <motion.span
              id={tooltipId}
              role="tooltip"
              className={cn(
                "pointer-events-none fixed z-[10020] whitespace-nowrap rounded-full border border-white/10 bg-[rgba(10,10,10,0.94)] px-2.5 py-1.5 text-[11px] font-medium leading-none text-foreground shadow-2xl",
                className,
              )}
              style={{
                left: position.left,
                top: position.top,
                translate: `${position.x} ${position.y}`,
              }}
              initial={{
                opacity: 0,
                scale: 0.96,
                y: side === "top" ? 3 : side === "bottom" ? -3 : 0,
              }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{
                opacity: 0,
                scale: 0.98,
                y: side === "top" ? 2 : side === "bottom" ? -2 : 0,
              }}
              transition={{ type: "spring", stiffness: 520, damping: 36, mass: 0.72 }}
            >
              {content}
            </motion.span>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
