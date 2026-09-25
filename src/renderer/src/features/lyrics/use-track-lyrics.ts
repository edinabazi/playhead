import { useCallback, useEffect, useRef, useState } from "react";
import type { TrackLyrics } from "../../../../shared/lyrics";

export function useTrackLyrics(trackId: string | null) {
  const [result, setResult] = useState<TrackLyrics | null>(null);
  const [loading, setLoading] = useState(Boolean(trackId));
  const [choosing, setChoosing] = useState(false);
  const [error, setError] = useState("");
  const request = useRef(0);
  const choosingRef = useRef(false);
  const alive = useRef(true);
  const refresh = useCallback(async () => {
    if (!trackId || choosingRef.current) return;
    const version = ++request.current;
    try {
      const next = await window.playhead.getTrackLyrics(trackId);
      if (alive.current && version === request.current) {
        setResult(next);
        setError("");
      }
    } catch {
      if (alive.current && version === request.current)
        setError(
          "Couldn't load lyrics. Check that the audio file is still available, then try again.",
        );
    } finally {
      if (alive.current && version === request.current) setLoading(false);
    }
  }, [trackId]);
  useEffect(() => {
    alive.current = true;
    void refresh();
    if (!trackId) return;
    void window.playhead.watchTrackLyrics(trackId).catch(() => {});
    const unsubscribe = window.playhead.onLyricsChanged((id) => {
      if (id === trackId) void refresh();
    });
    window.addEventListener("focus", refresh);
    return () => {
      alive.current = false;
      unsubscribe();
      window.removeEventListener("focus", refresh);
      void window.playhead.watchTrackLyrics(null).catch(() => {});
    };
  }, [trackId, refresh]);
  const choose = async (filePath?: string | null) => {
    if (!trackId || choosingRef.current) return;
    choosingRef.current = true;
    const version = ++request.current;
    setChoosing(true);
    setError("");
    let cancelled = false;
    try {
      const next = await window.playhead.selectTrackLyrics(trackId, filePath);
      cancelled = next === null;
      if (alive.current && version === request.current && next) {
        setResult(next);
        void window.playhead.watchTrackLyrics(trackId).catch(() => {});
      }
    } catch (cause) {
      if (alive.current && version === request.current) {
        const message = cause instanceof Error ? cause.message : "";
        const known = [
          "Choose an .lrc lyrics file.",
          "Choose a lyrics file smaller than 1 MB.",
          "This file doesn't contain any readable lyrics.",
          "Save this lyrics file as UTF-8 or UTF-16 and try again.",
          "This lyrics file has too many lines.",
        ];
        setError(
          known.find((text) => message.includes(text)) ??
            "Couldn't open that lyrics file. Check that it's available and try again.",
        );
      }
    } finally {
      choosingRef.current = false;
      if (alive.current) {
        setChoosing(false);
        setLoading(false);
        if (cancelled) void refresh();
      }
    }
  };
  return { result, loading, choosing, error, setError, refresh, choose };
}
