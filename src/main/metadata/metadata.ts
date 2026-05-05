import { extname } from "node:path";
import { parseFile } from "music-metadata";
import { ByteVector, File as TagFile, Picture, PictureType } from "node-taglib-sharp";
import type { EditableTrackMetadata, LibraryTrack, TrackMetadata } from "../../shared/library";
import { writableMetadataExtensions } from "../library/constants";
import { buildTrack } from "../library/scanner";

function stringifyMetadataValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(stringifyMetadataValue).filter(Boolean).join(", ");
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function isBinaryMetadataValue(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (value instanceof Uint8Array || Buffer.isBuffer(value)) return true;
  if (Array.isArray(value)) return value.some(isBinaryMetadataValue);
  if ("data" in value || "picture" in value || "imageBuffer" in value) return true;
  return false;
}

function isArtworkMetadataKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return (
    normalized === "picture" ||
    normalized.includes("picture") ||
    normalized.includes("artwork") ||
    normalized.includes("cover") ||
    normalized === "apic"
  );
}

function metadataRecord(values: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(values)
      .filter(([key, value]) => !isArtworkMetadataKey(key) && !isBinaryMetadataValue(value))
      .map(([key, value]) => [key, stringifyMetadataValue(value)])
      .filter(([, value]) => value),
  );
}

function editableFromCommon(common: Record<string, unknown>): EditableTrackMetadata {
  return {
    title: stringifyMetadataValue(common.title),
    artist: stringifyMetadataValue(common.artist),
    album: stringifyMetadataValue(common.album),
    albumArtist: stringifyMetadataValue(common.albumartist),
    genre: stringifyMetadataValue(common.genre),
    year: stringifyMetadataValue(common.year),
    trackNumber: stringifyMetadataValue((common.track as { no?: number } | undefined)?.no),
    diskNumber: stringifyMetadataValue((common.disk as { no?: number } | undefined)?.no),
    composer: stringifyMetadataValue(common.composer),
    bpm: stringifyMetadataValue(common.bpm),
    comment: stringifyMetadataValue(common.comment),
  };
}

export async function readTrackMetadata(filePath: string): Promise<TrackMetadata> {
  const metadata = await parseFile(filePath, { duration: true });
  const canSave = writableMetadataExtensions.has(extname(filePath).toLowerCase());

  return {
    editable: editableFromCommon(metadata.common as unknown as Record<string, unknown>),
    format: metadataRecord(metadata.format as unknown as Record<string, unknown>),
    common: metadataRecord(metadata.common as unknown as Record<string, unknown>),
    native: Object.values(metadata.native)
      .flat()
      .filter((tag) => !isArtworkMetadataKey(tag.id) && !isBinaryMetadataValue(tag.value))
      .map((tag) => ({ id: tag.id, value: stringifyMetadataValue(tag.value) }))
      .filter((tag) => tag.value),
    canSave,
    saveUnsupportedReason: canSave
      ? undefined
      : "Saving is currently supported for MP3, FLAC, and WAV files.",
  };
}

function cleanEditableMetadata(metadata: EditableTrackMetadata): EditableTrackMetadata {
  return {
    title: metadata.title.trim(),
    artist: metadata.artist.trim(),
    album: metadata.album.trim(),
    albumArtist: metadata.albumArtist.trim(),
    genre: metadata.genre.trim(),
    year: metadata.year.trim(),
    trackNumber: metadata.trackNumber.trim(),
    diskNumber: metadata.diskNumber.trim(),
    composer: metadata.composer.trim(),
    bpm: metadata.bpm.trim(),
    comment: metadata.comment.trim(),
  };
}

function splitList(value: string): string[] {
  return value
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function optionalNumber(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function saveTrackMetadata(
  filePath: string,
  folderId: string,
  metadata: EditableTrackMetadata,
): Promise<LibraryTrack> {
  if (!writableMetadataExtensions.has(extname(filePath).toLowerCase())) {
    throw new Error("Saving is currently supported for MP3, FLAC, and WAV files.");
  }

  const next = cleanEditableMetadata(metadata);
  const file = TagFile.createFromPath(filePath);

  try {
    file.tag.title = next.title;
    file.tag.performers = splitList(next.artist);
    file.tag.album = next.album;
    file.tag.albumArtists = splitList(next.albumArtist);
    file.tag.genres = splitList(next.genre);
    file.tag.year = optionalNumber(next.year);
    file.tag.track = optionalNumber(next.trackNumber);
    file.tag.disc = optionalNumber(next.diskNumber);
    file.tag.composers = splitList(next.composer);
    file.tag.beatsPerMinute = optionalNumber(next.bpm);
    file.tag.comment = next.comment;

    if (metadata.artwork) {
      file.tag.pictures = [
        Picture.fromFullData(
          ByteVector.fromByteArray(Buffer.from(metadata.artwork.data)),
          PictureType.FrontCover,
          metadata.artwork.mimeType,
          "Cover",
        ),
      ];
    }

    file.save();
  } finally {
    file.dispose();
  }

  return buildTrack(filePath, folderId);
}
