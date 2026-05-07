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
  const barCount = bars.length;

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
      <div
        className={`absolute inset-x-5 top-1/2 flex -translate-y-1/2 items-center justify-between gap-[2px] ${
          isLoading && !reduceMotion ? "waveform-skeleton-loading" : ""
        }`}
      >
        {bars.map((height, index) => (
          <span
            key={index}
            className="waveform-skeleton-bar w-[2px] rounded-full bg-white/25"
            style={{
              height: Math.max(8, height * 0.58),
              opacity: reduceMotion || !isLoading ? 0.24 : undefined,
              animationDelay: `${(index / barCount) * -1.72}s`,
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}
