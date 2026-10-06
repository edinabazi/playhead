import { useCallback, useEffect, useState } from "react";
import type { LibraryTrack, SoundCloudComment } from "../../../../shared/library";

// Replaying a recent track should not refetch its comments.
const cache = new Map<string, SoundCloudComment[]>();
const cacheLimit = 20;

function remember(trackId: string, comments: SoundCloudComment[]) {
  cache.delete(trackId);
  cache.set(trackId, comments);
  while (cache.size > cacheLimit) cache.delete(cache.keys().next().value!);
}

export function useSoundCloudComments(track: LibraryTrack | null, enabled: boolean) {
  const soundcloud = enabled ? track?.soundcloud : undefined;
  const trackId = soundcloud ? track!.id : null;
  const [state, setState] = useState<{ trackId: string; comments: SoundCloudComment[] } | null>(
    null,
  );

  useEffect(() => {
    if (!trackId || !soundcloud) return;
    const cached = cache.get(trackId);
    if (cached) {
      setState({ trackId, comments: cached });
      return;
    }
    let cancelled = false;
    // Let the stream start first; comments are decoration.
    const timer = window.setTimeout(() => {
      window.playhead
        .getSoundCloudComments(soundcloud.id, soundcloud.urn)
        .then((comments) => {
          remember(trackId, comments);
          if (!cancelled) setState({ trackId, comments });
        })
        .catch(() => undefined);
    }, 600);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [soundcloud, trackId]);

  const addComment = useCallback((id: string, comment: SoundCloudComment) => {
    const comments = [...(cache.get(id) || []), comment].sort((a, b) => a.time - b.time);
    remember(id, comments);
    setState((current) => (current?.trackId === id ? { trackId: id, comments } : current));
  }, []);

  return {
    comments: state && state.trackId === trackId ? state.comments : [],
    addComment,
  };
}
