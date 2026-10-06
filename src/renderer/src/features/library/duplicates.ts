import type { LibraryTrack } from "../../../../shared/library";

// Copies of the same recording rarely differ by more than a few seconds of silence.
const durationToleranceSeconds = 3;

function normalize(value: string | undefined) {
  return (value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Groups local tracks that look like the same recording: same artist and title (ignoring
 * case, accents and punctuation) and lengths within a few seconds. Largest groups first.
 */
export function findDuplicateGroups(tracks: LibraryTrack[]): LibraryTrack[][] {
  const byName = new Map<string, LibraryTrack[]>();
  for (const track of tracks) {
    if (track.soundcloud || track.source === "soundcloud") continue;
    const title = normalize(track.title);
    if (!title) continue;
    const key = `${normalize(track.artist)}|${title}`;
    const group = byName.get(key);
    if (group) group.push(track);
    else byName.set(key, [track]);
  }

  const groups: LibraryTrack[][] = [];
  for (const candidates of byName.values()) {
    if (candidates.length < 2) continue;
    // Split same-named tracks into runs of similar length (e.g. radio edit vs extended mix).
    const sorted = candidates.slice().sort((a, b) => (a.duration || 0) - (b.duration || 0));
    let run: LibraryTrack[] = [sorted[0]];
    for (const track of sorted.slice(1)) {
      const previous = run[run.length - 1];
      if (Math.abs((track.duration || 0) - (previous.duration || 0)) <= durationToleranceSeconds) {
        run.push(track);
      } else {
        if (run.length > 1) groups.push(run);
        run = [track];
      }
    }
    if (run.length > 1) groups.push(run);
  }
  return groups.sort((a, b) => b.length - a.length || a[0].title.localeCompare(b[0].title));
}
