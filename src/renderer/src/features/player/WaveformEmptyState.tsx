import { motion } from "framer-motion";

export function WaveformEmptyState({
  isLoading,
  reduceMotion,
}: {
  isLoading: boolean;
  reduceMotion: boolean;
}) {
  const bars = [
    18, 24, 31, 42, 34, 49, 28, 38, 56, 46, 30, 41, 62, 36, 50, 26, 44, 58, 32, 47, 22, 39, 54, 35,
    48, 27, 43, 60, 33, 51, 24, 37, 55, 31, 45, 64, 38, 52, 29, 41, 57, 34, 49, 25, 40, 53, 30, 46,
    59, 35, 50, 28, 42, 56, 32, 47, 23, 39, 54, 36, 48, 26, 44, 58,
  ];

  return (
    <motion.div
      className="absolute inset-0 overflow-hidden rounded-[20px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{
        opacity: { duration: reduceMotion ? 0 : 0.16 },
      }}
    >
      <div className="absolute inset-x-5 top-1/2 flex -translate-y-1/2 items-center justify-between gap-[2px]">
        {bars.map((height, index) => (
          <motion.span
            key={index}
            className="w-[2px] rounded-full bg-white/25"
            initial={{ height: Math.max(8, height * 0.52), opacity: 0.24 }}
            animate={{
              height: reduceMotion
                ? height * 0.52
                : isLoading
                  ? [height * 0.48, height * 0.86, height * 0.58]
                  : height * 0.52,
              opacity: reduceMotion ? 0.24 : isLoading ? [0.22, 0.48, 0.28] : 0.24,
            }}
            transition={{
              duration: reduceMotion ? 0 : 0.92,
              delay: (index % 16) * 0.025,
              repeat: reduceMotion ? 0 : isLoading ? Infinity : 0,
              ease: [0.22, 1, 0.36, 1],
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}
