import { useEffect, useRef, useState } from "react";

const pollIntervalMs = 100;
const holdMs = 300;
const activeReductionDb = -0.5;

export function useLimiterActivity(getReduction: () => number, enabled: boolean): boolean {
  const [active, setActive] = useState(false);
  const getReductionRef = useRef(getReduction);

  useEffect(() => {
    getReductionRef.current = getReduction;
  }, [getReduction]);

  useEffect(() => {
    if (!enabled) {
      setActive(false);
      return;
    }

    let lastActiveAt = 0;
    const interval = window.setInterval(() => {
      const now = performance.now();
      if (getReductionRef.current() <= activeReductionDb) lastActiveAt = now;
      setActive(now - lastActiveAt < holdMs);
    }, pollIntervalMs);

    return () => window.clearInterval(interval);
  }, [enabled]);

  return active;
}
