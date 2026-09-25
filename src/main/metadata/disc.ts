import type { IAudioMetadata } from "music-metadata";

const discTagIds = new Set(["TPOS", "TPA", "DISCNUMBER", "DISC", "DISK", "WM/PARTOFSET"]);

// Keep the original tag: some collections use the Disc field for text such as a mood.
export function getDiscMetadata(metadata: IAudioMetadata): string | undefined {
  for (const tags of Object.values(metadata.native || {})) {
    for (const tag of tags) {
      if (!discTagIds.has(tag.id.toUpperCase())) continue;
      if (typeof tag.value !== "string" && typeof tag.value !== "number") continue;
      const value = String(tag.value).trim();
      if (value) return value;
    }
  }
  return metadata.common.disk.no ? String(metadata.common.disk.no) : undefined;
}
