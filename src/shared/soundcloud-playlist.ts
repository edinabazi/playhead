import type { SoundCloudPlaylistEdit } from "./library";

export function applySoundCloudPlaylistEdit(current: number[], edit: SoundCloudPlaylistEdit) {
  const ids = new Set(edit.trackIds);
  if (edit.type === "add") return [...current, ...[...ids].filter((id) => !current.includes(id))];
  if (edit.type === "remove") return current.filter((id) => !ids.has(id));
  if (ids.has(edit.targetTrackId)) return current;
  const moving = current.filter((id) => ids.has(id));
  const rest = current.filter((id) => !ids.has(id));
  const target = rest.indexOf(edit.targetTrackId);
  if (target === -1 || moving.length === 0) return current;
  const insertAt = edit.edge === "after" ? target + 1 : target;
  return [...rest.slice(0, insertAt), ...moving, ...rest.slice(insertAt)];
}
