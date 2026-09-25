import { useCallback, useEffect, useRef, useState } from "react";

export function useLibraryScan() {
  const [scanId, setScanId] = useState<string | null>(null);
  const active = useRef<string | null>(null);
  const startScan = useCallback(() => {
    if (active.current) return null;
    const id = crypto.randomUUID();
    active.current = id;
    setScanId(id);
    return id;
  }, []);
  const finishScan = useCallback((id: string) => {
    if (active.current !== id) return;
    active.current = null;
    setScanId(null);
  }, []);
  useEffect(
    () => () => {
      if (active.current) void window.playhead.cancelLibraryScan(active.current);
    },
    [],
  );
  return { scanId, isScanning: scanId !== null, startScan, finishScan };
}
