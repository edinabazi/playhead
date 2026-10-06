import type { LibraryTrack } from "./library";

export type SmartPlaylistField =
  | "title"
  | "artist"
  | "album"
  | "genre"
  | "composer"
  | "format"
  | "year"
  | "bpm"
  | "duration"
  | "modified"
  | "loved"
  | "tag";

export type SmartPlaylistOperator =
  | "contains"
  | "notContains"
  | "is"
  | "isNot"
  | "startsWith"
  | "greaterThan"
  | "lessThan"
  | "between"
  | "inLastDays";

export type SmartPlaylistRule = {
  id: string;
  field: SmartPlaylistField;
  operator: SmartPlaylistOperator;
  value: string;
  /** Upper bound for "between". */
  value2?: string;
};

export type SmartPlaylist = {
  id: string;
  name: string;
  match: "all" | "any";
  rules: SmartPlaylistRule[];
  createdAt: string;
  updatedAt: string;
};

export type SmartPlaylistFieldKind = "text" | "number" | "date" | "boolean" | "tag";

export const smartPlaylistFields: Record<
  SmartPlaylistField,
  { label: string; kind: SmartPlaylistFieldKind }
> = {
  title: { label: "Title", kind: "text" },
  artist: { label: "Artist", kind: "text" },
  album: { label: "Album", kind: "text" },
  genre: { label: "Genre", kind: "text" },
  composer: { label: "Composer", kind: "text" },
  format: { label: "Format", kind: "text" },
  year: { label: "Year", kind: "number" },
  bpm: { label: "BPM", kind: "number" },
  duration: { label: "Length (minutes)", kind: "number" },
  modified: { label: "File modified", kind: "date" },
  loved: { label: "Loved", kind: "boolean" },
  tag: { label: "Tag", kind: "tag" },
};

export const smartPlaylistOperators: Record<
  SmartPlaylistFieldKind,
  Array<{ value: SmartPlaylistOperator; label: string }>
> = {
  text: [
    { value: "contains", label: "contains" },
    { value: "notContains", label: "doesn't contain" },
    { value: "is", label: "is" },
    { value: "isNot", label: "is not" },
    { value: "startsWith", label: "starts with" },
  ],
  number: [
    { value: "is", label: "is" },
    { value: "greaterThan", label: "is greater than" },
    { value: "lessThan", label: "is less than" },
    { value: "between", label: "is between" },
  ],
  date: [{ value: "inLastDays", label: "in the last (days)" }],
  boolean: [
    { value: "is", label: "is" },
    { value: "isNot", label: "is not" },
  ],
  tag: [
    { value: "is", label: "is" },
    { value: "isNot", label: "is not" },
  ],
};

export type SmartPlaylistContext = {
  favoriteTrackIds: Set<string>;
  /** Tag ids per track id. */
  tagsByTrackId: Map<string, Set<string>>;
  now: number;
};

const dayMs = 24 * 60 * 60 * 1000;

function textValue(track: LibraryTrack, field: SmartPlaylistField): string {
  if (field === "format") return track.audioFormat || "";
  const value = track[field as "title" | "artist" | "album" | "genre" | "composer"];
  return (value || "").toLowerCase();
}

function numberValue(track: LibraryTrack, field: SmartPlaylistField): number | undefined {
  if (field === "duration") return track.duration ? track.duration / 60 : undefined;
  const value = field === "year" ? track.year : track.bpm;
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function matchesRule(
  track: LibraryTrack,
  rule: SmartPlaylistRule,
  context: SmartPlaylistContext,
): boolean {
  const kind = smartPlaylistFields[rule.field]?.kind;
  if (kind === "text") {
    const actual = textValue(track, rule.field).toLowerCase();
    const expected = rule.value.trim().toLowerCase();
    if (rule.operator === "contains") return actual.includes(expected);
    if (rule.operator === "notContains") return !actual.includes(expected);
    if (rule.operator === "is") return actual === expected;
    if (rule.operator === "isNot") return actual !== expected;
    if (rule.operator === "startsWith") return actual.startsWith(expected);
    return false;
  }
  if (kind === "number") {
    const actual = numberValue(track, rule.field);
    const expected = Number(rule.value);
    if (actual === undefined || !Number.isFinite(expected)) return false;
    if (rule.operator === "is") return Math.abs(actual - expected) < 0.5;
    if (rule.operator === "greaterThan") return actual > expected;
    if (rule.operator === "lessThan") return actual < expected;
    if (rule.operator === "between") {
      const upper = Number(rule.value2);
      if (!Number.isFinite(upper)) return false;
      return actual >= Math.min(expected, upper) && actual <= Math.max(expected, upper);
    }
    return false;
  }
  if (kind === "date") {
    const days = Number(rule.value);
    if (!track.fileModifiedAt || !Number.isFinite(days)) return false;
    return context.now - track.fileModifiedAt <= days * dayMs;
  }
  if (kind === "boolean") {
    const loved = context.favoriteTrackIds.has(track.id);
    return rule.operator === "isNot" ? !loved : loved;
  }
  if (kind === "tag") {
    const hasTag = context.tagsByTrackId.get(track.id)?.has(rule.value) ?? false;
    return rule.operator === "isNot" ? !hasTag : hasTag;
  }
  return false;
}

export function matchesSmartPlaylist(
  track: LibraryTrack,
  playlist: Pick<SmartPlaylist, "match" | "rules">,
  context: SmartPlaylistContext,
): boolean {
  if (playlist.rules.length === 0) return false;
  return playlist.match === "any"
    ? playlist.rules.some((rule) => matchesRule(track, rule, context))
    : playlist.rules.every((rule) => matchesRule(track, rule, context));
}

export function buildSmartPlaylistContext(
  favoriteTrackIds: string[] | undefined,
  tags: Array<{ id: string; trackIds: string[] }> | undefined,
  now = Date.now(),
): SmartPlaylistContext {
  const tagsByTrackId = new Map<string, Set<string>>();
  for (const tag of tags || []) {
    for (const trackId of tag.trackIds) {
      const set = tagsByTrackId.get(trackId) || new Set<string>();
      set.add(tag.id);
      tagsByTrackId.set(trackId, set);
    }
  }
  return { favoriteTrackIds: new Set(favoriteTrackIds || []), tagsByTrackId, now };
}
