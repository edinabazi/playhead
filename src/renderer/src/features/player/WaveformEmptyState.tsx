import { motion } from "framer-motion";

export function WaveformEmptyState({
  isLoading,
  hasTrack,
}: {
  isLoading: boolean;
  hasTrack: boolean;
}) {
  const bars = [
    18, 26, 40, 32, 50, 28, 42, 58, 34, 46, 24, 38, 54, 30, 44, 62, 36, 50, 28, 42, 56, 34, 48, 26,
    40, 52, 30, 44, 58, 34, 46, 24,
  ];

  return (
    <motion.div
      className="absolute inset-0 overflow-hidden rounded-[20px] border border-white/[0.07] bg-white/[0.035]"
      initial={{ opacity: 0, y: 6, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, y: -4, filter: "blur(8px)" }}
      transition={{
        type: "spring",
        stiffness: 420,
        damping: 34,
        mass: 0.72,
        opacity: { duration: 0.16 },
        filter: { duration: 0.2 },
      }}
    >
      <div className="absolute inset-x-4 top-1/2 h-px -translate-y-1/2 bg-white/[0.14]" />
      <motion.div
        className="absolute inset-y-0 w-24 bg-gradient-to-r from-transparent via-white/[0.09] to-transparent"
        initial={{ x: "-35%" }}
        animate={{ x: "720%" }}
        transition={{ duration: 1.45, ease: "linear", repeat: Infinity }}
      />
      <div className="absolute inset-x-5 top-1/2 flex -translate-y-1/2 items-center justify-between gap-[3px]">
        {bars.map((height, index) => (
          <motion.span
            key={index}
            className="w-[3px] rounded-full bg-white/[0.16]"
            initial={{ height: Math.max(10, height * 0.45), opacity: 0.28 }}
            animate={{
              height: isLoading ? [height * 0.55, height, height * 0.68] : height * 0.55,
              opacity: isLoading ? [0.22, 0.5, 0.28] : 0.22,
            }}
            transition={{
              duration: 1.1,
              delay: index * 0.018,
              repeat: isLoading ? Infinity : 0,
              ease: [0.22, 1, 0.36, 1],
            }}
          />
        ))}
      </div>
      <div className="absolute inset-0 grid place-items-center">
        <motion.div
          className="rounded-full border border-white/[0.08] bg-black/35 px-3 py-1.5 text-[11px] font-medium text-muted-foreground backdrop-blur-md"
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.18 }}
        >
          {isLoading ? "Building waveform" : hasTrack ? "Preparing waveform" : "No waveform loaded"}
        </motion.div>
      </div>
    </motion.div>
  );
}

