import type { SVGProps } from "react";
import { motion } from "framer-motion";

type MediaIconProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

export function PlayFilledIcon({ size = 24, ...props }: MediaIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M5 5c0-.352.093-.698.269-1.002a2 2 0 0 1 2.739-.726l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7a2 2 0 0 1-3.008-1.728V5Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function PauseFilledIcon({ size = 24, ...props }: MediaIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M18 3h-3a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1Z"
        fill="currentColor"
      />
      <path
        d="M9 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function PlayPauseMorphIcon({
  playing,
  size = 24,
  ...props
}: MediaIconProps & { playing: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <motion.g
        animate={{ opacity: playing ? 0 : 1, scale: playing ? 0.82 : 1 }}
        initial={false}
        transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
        style={{ originX: "50%", originY: "50%" }}
      >
        <path d="M5 5 L12 8.7 L12 15.3 L5 19 Z" fill="currentColor" />
        <path d="M12 8.7 L20 12 L12 15.3 L12 8.7 Z" fill="currentColor" />
      </motion.g>
      <motion.g
        animate={{ opacity: playing ? 1 : 0, scale: playing ? 1 : 0.82 }}
        initial={false}
        transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
        style={{ originX: "50%", originY: "50%" }}
      >
        <path d="M5 4 L10 4 L10 20 L5 20 Z" fill="currentColor" />
        <path d="M14 4 L19 4 L19 20 L14 20 Z" fill="currentColor" />
      </motion.g>
    </svg>
  );
}

export function SkipBackFilledIcon({ size = 16, ...props }: MediaIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path d="M2 13.333V2.667" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M11.981 13.143c.202.122.433.187.669.19.236.003.468-.057.674-.173.205-.116.376-.285.495-.489.118-.203.181-.435.181-.671V4c0-.236-.063-.468-.181-.672a1.333 1.333 0 0 0-1.169-.662 1.333 1.333 0 0 0-.669.19L5.316 6.855a1.333 1.333 0 0 0-.002 2.288l6.667 4Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function SkipForwardFilledIcon({ size = 16, ...props }: MediaIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path d="M14 2.667v10.666" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M4.019 2.857a1.333 1.333 0 0 0-.669-.19 1.333 1.333 0 0 0-1.169.661A1.333 1.333 0 0 0 2 4v8c0 .236.063.468.181.672.119.203.29.372.495.488.206.117.438.176.674.173.236-.003.467-.068.669-.19l6.665-3.998a1.333 1.333 0 0 0 .002-2.288l-6.667-4Z"
        fill="currentColor"
      />
    </svg>
  );
}
