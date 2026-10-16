import { basename, dirname, extname, isAbsolute, join, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type {
  LibraryPlaylist,
  LibraryTrack,
  PlaylistExportFormat,
  PlaylistImportFormat,
  PlaylistImportPlaylist,
  PlaylistImportTrack,
} from "../../shared/library";

export type PlaylistExportTrack = Pick<LibraryTrack, "artist" | "duration" | "path" | "title"> &
  Partial<
    Pick<
      LibraryTrack,
      | "album"
      | "audioFormat"
      | "bitRate"
      | "bpm"
      | "fileName"
      | "id"
      | "sampleRate"
      | "source"
      | "trackNumber"
      | "year"
    >
  >;

export type PlaylistExportBuildResult = {
  content: string;
  exportedTrackCount: number;
  skippedTrackCount: number;
};

export type PlaylistImportParseResult = {
  format: PlaylistImportFormat;
  playlists: PlaylistImportPlaylist[];
};

const playlistExportExtensions: Record<PlaylistExportFormat, string> = {
  m3u: "m3u",
  m3u8: "m3u8",
  playhead: "playhead-playlist.json",
  rekordbox: "xml",
  traktor: "nml",
};

const playlistExportFilterNames: Record<PlaylistExportFormat, string> = {
  m3u: "M3U",
  m3u8: "M3U8",
  playhead: "Playhead Playlist",
  rekordbox: "rekordbox XML",
  traktor: "Traktor NML",
};

function cleanLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function getExtinfTitle(track: PlaylistExportTrack): string {
  const title = cleanLine(track.title);
  const artist = cleanLine(track.artist);
  if (artist && title) return `${artist} - ${title}`;
  return title || artist || basename(track.path);
}

function getExtinfDuration(track: PlaylistExportTrack): number {
  if (!Number.isFinite(track.duration) || track.duration <= 0) return -1;
  return Math.round(track.duration);
}

function isLocalExportTrack(track: Pick<PlaylistExportTrack, "path" | "source">): boolean {
  return track.source !== "soundcloud" && !track.path.startsWith("soundcloud:");
}

function numberOrUndefined(value: unknown): number | undefined {
  const number = typeof value === "number" ? value : Number.parseFloat(String(value || ""));
  return Number.isFinite(number) ? number : undefined;
}

function xmlEscape(value: string | number | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function xmlUnescape(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_match, decimal: string) =>
      String.fromCodePoint(Number.parseInt(decimal, 10)),
    )
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function parseXmlAttributes(rawAttributes: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const regex = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(rawAttributes))) {
    attrs[match[1]] = xmlUnescape(match[2] ?? match[3] ?? "");
  }

  return attrs;
}

function getFileUrl(filePath: string): string {
  const url = pathToFileURL(filePath);
  return `file://localhost${url.pathname}`;
}

function parsePathValue(value: string, baseDirectory?: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  if (/^file:/i.test(trimmed)) {
    try {
      return fileURLToPath(trimmed);
    } catch {
      return decodeURIComponent(trimmed.replace(/^file:\/\/(?:localhost)?/i, ""));
    }
  }

  const normalized = trimmed.replace(/\\/g, sep);
  const isAbsoluteLike = isAbsolute(normalized) || /^[a-z]:[\\/]/i.test(trimmed);
  return isAbsoluteLike || !baseDirectory ? normalized : resolve(baseDirectory, normalized);
}

function splitExtinfTitle(value: string): Pick<PlaylistImportTrack, "artist" | "title"> {
  const trimmed = value.trim();
  const separatorIndex = trimmed.indexOf(" - ");
  if (separatorIndex <= 0) return { title: trimmed };

  return {
    artist: trimmed.slice(0, separatorIndex).trim(),
    title: trimmed.slice(separatorIndex + 3).trim(),
  };
}

function parseExtinf(line: string): PlaylistImportTrack {
  const match = /^#EXTINF:([^,]*),(.*)$/i.exec(line);
  if (!match) return {};

  return {
    duration: numberOrUndefined(match[1]),
    ...splitExtinfTitle(match[2]),
  };
}

function compactTrack(track: PlaylistImportTrack): PlaylistImportTrack {
  return Object.fromEntries(
    Object.entries(track).filter(
      ([, value]) => value !== undefined && value !== null && value !== "",
    ),
  ) as PlaylistImportTrack;
}

function buildM3uContent(
  playlist: LibraryPlaylist,
  tracks: PlaylistExportTrack[],
): PlaylistExportBuildResult {
  const lines = ["#EXTM3U", `#PLAYLIST:${cleanLine(playlist.name)}`];
  let exportedTrackCount = 0;
  let skippedTrackCount = 0;

  for (const track of tracks) {
    if (!isLocalExportTrack(track)) {
      skippedTrackCount += 1;
      continue;
    }

    lines.push(`#EXTINF:${getExtinfDuration(track)},${getExtinfTitle(track)}`, track.path);
    exportedTrackCount += 1;
  }

  return {
    content: `${lines.join("\n")}\n`,
    exportedTrackCount,
    skippedTrackCount,
  };
}

function buildPlayheadContent(
  playlist: LibraryPlaylist,
  tracks: PlaylistExportTrack[],
): PlaylistExportBuildResult {
  const payload = {
    schema: "playhead.playlist",
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    playlist: {
      id: playlist.id,
      name: playlist.name,
      createdAt: playlist.createdAt,
      updatedAt: playlist.updatedAt,
    },
    tracks: tracks.map((track) => ({
      id: track.id,
      path: track.path,
      fileName: track.fileName,
      title: track.title,
      artist: track.artist,
      album: track.album,
      duration: track.duration,
      bpm: track.bpm,
      year: track.year,
      trackNumber: track.trackNumber,
      audioFormat: track.audioFormat,
      sampleRate: track.sampleRate,
      bitRate: track.bitRate,
      source: track.source || "local",
    })),
  };

  return {
    content: `${JSON.stringify(payload, null, 2)}\n`,
    exportedTrackCount: tracks.length,
    skippedTrackCount: 0,
  };
}

function localTracksWithSkipped(tracks: PlaylistExportTrack[]): {
  tracks: PlaylistExportTrack[];
  skippedTrackCount: number;
} {
  const localTracks = tracks.filter(isLocalExportTrack);
  return {
    tracks: localTracks,
    skippedTrackCount: tracks.length - localTracks.length,
  };
}

function buildRekordboxXmlContent(
  playlist: LibraryPlaylist,
  tracks: PlaylistExportTrack[],
): PlaylistExportBuildResult {
  const local = localTracksWithSkipped(tracks);
  const trackEntries = local.tracks
    .map((track, index) => {
      const attrs = [
        `TrackID="${index + 1}"`,
        `Name="${xmlEscape(track.title)}"`,
        `Artist="${xmlEscape(track.artist)}"`,
        track.album ? `Album="${xmlEscape(track.album)}"` : "",
        `TotalTime="${getExtinfDuration(track)}"`,
        track.bpm ? `AverageBpm="${xmlEscape(track.bpm)}"` : "",
        track.audioFormat ? `Kind="${xmlEscape(track.audioFormat)}"` : "",
        `Location="${xmlEscape(getFileUrl(track.path))}"`,
      ].filter(Boolean);

      return `    <TRACK ${attrs.join(" ")} />`;
    })
    .join("\n");
  const playlistTracks = local.tracks
    .map((_track, index) => `        <TRACK Key="${index + 1}" />`)
    .join("\n");

  return {
    content: [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<DJ_PLAYLISTS Version="1.0.0">',
      '  <PRODUCT Name="Playhead" Version="1.0" Company="Playhead" />',
      `  <COLLECTION Entries="${local.tracks.length}">`,
      trackEntries,
      "  </COLLECTION>",
      "  <PLAYLISTS>",
      '    <NODE Type="0" Name="ROOT" Count="1">',
      `      <NODE Name="${xmlEscape(playlist.name)}" Type="1" KeyType="0" Entries="${local.tracks.length}">`,
      playlistTracks,
      "      </NODE>",
      "    </NODE>",
      "  </PLAYLISTS>",
      "</DJ_PLAYLISTS>",
      "",
    ].join("\n"),
    exportedTrackCount: local.tracks.length,
    skippedTrackCount: local.skippedTrackCount,
  };
}

function buildTraktorNmlContent(
  playlist: LibraryPlaylist,
  tracks: PlaylistExportTrack[],
): PlaylistExportBuildResult {
  const local = localTracksWithSkipped(tracks);
  const entries = local.tracks
    .map((track) => {
      const directory = dirname(track.path);
      const fileName = basename(track.path);
      const album = track.album ? `      <ALBUM TITLE="${xmlEscape(track.album)}" />\n` : "";
      const tempo = track.bpm
        ? `      <TEMPO BPM="${xmlEscape(track.bpm)}" BPM_QUALITY="100" />\n`
        : "";

      return [
        `    <ENTRY TITLE="${xmlEscape(track.title)}" ARTIST="${xmlEscape(track.artist)}">`,
        `      <LOCATION DIR="${xmlEscape(`${directory}${sep}`)}" FILE="${xmlEscape(fileName)}" VOLUME="" />`,
        album.trimEnd(),
        `      <INFO PLAYTIME="${getExtinfDuration(track)}" PLAYTIME_FLOAT="${xmlEscape(track.duration || 0)}" />`,
        tempo.trimEnd(),
        "    </ENTRY>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");
  const playlistEntries = local.tracks
    .map(
      (track) =>
        `            <ENTRY><PRIMARYKEY TYPE="TRACK" KEY="${xmlEscape(track.path)}" /></ENTRY>`,
    )
    .join("\n");

  return {
    content: [
      '<?xml version="1.0" encoding="UTF-8" standalone="no"?>',
      '<NML VERSION="24">',
      '  <HEAD COMPANY="Native Instruments" PROGRAM="Traktor" />',
      "  <MUSICFOLDERS />",
      `  <COLLECTION ENTRIES="${local.tracks.length}">`,
      entries,
      "  </COLLECTION>",
      "  <PLAYLISTS>",
      '    <NODE TYPE="FOLDER" NAME="$ROOT">',
      '      <SUBNODES COUNT="1">',
      `        <NODE TYPE="PLAYLIST" NAME="${xmlEscape(playlist.name)}">`,
      `          <PLAYLIST ENTRIES="${local.tracks.length}" TYPE="LIST">`,
      playlistEntries,
      "          </PLAYLIST>",
      "        </NODE>",
      "      </SUBNODES>",
      "    </NODE>",
      "  </PLAYLISTS>",
      "</NML>",
      "",
    ].join("\n"),
    exportedTrackCount: local.tracks.length,
    skippedTrackCount: local.skippedTrackCount,
  };
}

export function sanitizePlaylistExportFileName(name: string): string {
  const sanitized = name
    .trim()
    .replace(/[<>:"/\\|?*]+/g, " ")
    .split("")
    .filter((character) => character.charCodeAt(0) >= 32)
    .join("")
    .replace(/\s+/g, " ")
    .trim();

  return sanitized || "playlist";
}

export function getPlaylistExportExtension(format: PlaylistExportFormat): string {
  return playlistExportExtensions[format];
}

export function getPlaylistExportFilter(format: PlaylistExportFormat): {
  name: string;
  extensions: string[];
} {
  const extension = getPlaylistExportExtension(format);
  return {
    name: playlistExportFilterNames[format],
    extensions: extension.split(".").slice(-1),
  };
}

export function getPlaylistExportDefaultPath(
  playlistName: string,
  format: PlaylistExportFormat,
): string {
  return `${sanitizePlaylistExportFileName(playlistName)}.${getPlaylistExportExtension(format)}`;
}

export function isSupportedPlaylistExportFormat(format: string): format is PlaylistExportFormat {
  return Object.prototype.hasOwnProperty.call(playlistExportExtensions, format);
}

export function buildPlaylistExportContent(
  playlist: LibraryPlaylist,
  tracks: PlaylistExportTrack[],
  format: PlaylistExportFormat = "m3u",
): PlaylistExportBuildResult {
  if (format === "playhead") return buildPlayheadContent(playlist, tracks);
  if (format === "rekordbox") return buildRekordboxXmlContent(playlist, tracks);
  if (format === "traktor") return buildTraktorNmlContent(playlist, tracks);
  return buildM3uContent(playlist, tracks);
}

function parseM3uPlaylist(
  filePath: string,
  text: string,
  format: "m3u" | "m3u8",
): PlaylistImportParseResult {
  const baseDirectory = dirname(filePath);
  let playlistName = basename(filePath, extname(filePath));
  const tracks: PlaylistImportTrack[] = [];
  let pendingMetadata: PlaylistImportTrack = {};

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    if (/^#PLAYLIST:/i.test(line)) {
      playlistName = line.replace(/^#PLAYLIST:/i, "").trim() || playlistName;
      continue;
    }

    if (/^#EXTINF:/i.test(line)) {
      pendingMetadata = parseExtinf(line);
      continue;
    }

    if (line.startsWith("#")) continue;

    tracks.push(
      compactTrack({
        ...pendingMetadata,
        path: parsePathValue(line, baseDirectory),
      }),
    );
    pendingMetadata = {};
  }

  return {
    format,
    playlists: [{ name: playlistName, tracks }],
  };
}

function importTrackFromRaw(raw: unknown): PlaylistImportTrack | null {
  if (!raw || typeof raw !== "object") return null;
  const track = raw as Record<string, unknown>;
  const path = typeof track.path === "string" ? track.path : undefined;
  const title = typeof track.title === "string" ? track.title : undefined;
  const artist = typeof track.artist === "string" ? track.artist : undefined;
  if (!path && !title && !artist) return null;

  return compactTrack({
    path,
    title,
    artist,
    album: typeof track.album === "string" ? track.album : undefined,
    duration: numberOrUndefined(track.duration),
    bpm: numberOrUndefined(track.bpm),
  });
}

function parsePlayheadPlaylistJson(text: string): PlaylistImportParseResult {
  const parsed = JSON.parse(text) as Record<string, unknown>;

  if (parsed.schema === "playhead.playlist" && parsed.playlist && Array.isArray(parsed.tracks)) {
    const playlist = parsed.playlist as Record<string, unknown>;
    return {
      format: "playhead",
      playlists: [
        {
          name: typeof playlist.name === "string" ? playlist.name : "Imported Playlist",
          tracks: parsed.tracks
            .map(importTrackFromRaw)
            .filter((track): track is PlaylistImportTrack => Boolean(track)),
        },
      ],
    };
  }

  if (Array.isArray(parsed.playlists) && parsed.tracks && typeof parsed.tracks === "object") {
    const tracksById = parsed.tracks as Record<string, unknown>;
    const playlists = parsed.playlists
      .map((playlist): PlaylistImportPlaylist | null => {
        if (!playlist || typeof playlist !== "object") return null;
        const rawPlaylist = playlist as Record<string, unknown>;
        if (!Array.isArray(rawPlaylist.trackIds)) return null;
        return {
          name: typeof rawPlaylist.name === "string" ? rawPlaylist.name : "Imported Playlist",
          tracks: rawPlaylist.trackIds
            .map((trackId) => importTrackFromRaw(tracksById[String(trackId)]))
            .filter((track): track is PlaylistImportTrack => Boolean(track)),
        };
      })
      .filter((playlist): playlist is PlaylistImportPlaylist => Boolean(playlist));

    return { format: "playhead", playlists };
  }

  throw new Error("That JSON file is not a Playhead playlist.");
}

function parseRekordboxXml(filePath: string, text: string): PlaylistImportParseResult {
  const baseDirectory = dirname(filePath);
  const tracksById = new Map<string, PlaylistImportTrack>();
  const tracksByLocation = new Map<string, PlaylistImportTrack>();

  for (const match of text.matchAll(/<TRACK\b([^>]*)\/?>/g)) {
    const attrs = parseXmlAttributes(match[1]);
    if (!attrs.TrackID && !attrs.Location) continue;

    const track = compactTrack({
      path: attrs.Location ? parsePathValue(attrs.Location, baseDirectory) : undefined,
      title: attrs.Name,
      artist: attrs.Artist,
      album: attrs.Album,
      duration: numberOrUndefined(attrs.TotalTime),
      bpm: numberOrUndefined(attrs.AverageBpm),
    });

    if (attrs.TrackID) tracksById.set(attrs.TrackID, track);
    if (attrs.Location) tracksByLocation.set(attrs.Location, track);
    if (track.path) tracksByLocation.set(track.path, track);
  }

  const playlists: PlaylistImportPlaylist[] = [];
  for (const match of text.matchAll(/<NODE\b([^>]*\bType=["']1["'][^>]*)>([\s\S]*?)<\/NODE>/g)) {
    const attrs = parseXmlAttributes(match[1]);
    const keyType = attrs.KeyType || "0";
    const tracks = Array.from(match[2].matchAll(/<TRACK\b([^>]*)\/?>/g))
      .map((trackMatch) => {
        const trackAttrs = parseXmlAttributes(trackMatch[1]);
        const key = trackAttrs.Key;
        if (!key) return null;
        if (keyType === "1") return tracksByLocation.get(key) || { path: parsePathValue(key) };
        return tracksById.get(key) || tracksByLocation.get(key) || null;
      })
      .filter((track): track is PlaylistImportTrack => Boolean(track));

    playlists.push({
      name: attrs.Name || basename(filePath, extname(filePath)),
      tracks,
    });
  }

  if (playlists.length === 0 && tracksById.size > 0) {
    playlists.push({
      name: basename(filePath, extname(filePath)),
      tracks: Array.from(tracksById.values()),
    });
  }

  return { format: "rekordbox", playlists };
}

/**
 * Traktor stores a path as `VOLUME`, `DIR` and `FILE`, using `:` between
 * components, with `/:` marking an absolute root. Files written on one platform
 * are routinely opened on another, so both separator styles are folded into the
 * running platform's separator, and a bare leading `/` or `\` is also treated as
 * an absolute root — otherwise a Unix path like `/music/` would lose its leading
 * separator and stop matching the collection entry's key.
 */
function normalizeTraktorPathPart(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  // A drive prefix ("C:") is part of the path, not a component separator, so it
  // is preserved before the remaining colons are folded into separators.
  const driveMatch = /^([A-Za-z]):(.*)$/.exec(trimmed);
  const drive = driveMatch ? `${driveMatch[1]}:` : "";
  const rest = driveMatch ? driveMatch[2] : trimmed;

  const explicitRoot = rest.startsWith("/:") || rest.startsWith("\\:");
  const bareRoot = !explicitRoot && /^[\\/]/.test(rest);
  const body = explicitRoot ? rest.slice(2) : bareRoot ? rest.slice(1) : rest;
  const parts = body.split(/[:\\/]+/).filter(Boolean);
  const joined = parts.join(sep);

  if (drive) return joined ? `${drive}${sep}${joined}` : `${drive}${sep}`;
  if (explicitRoot || bareRoot) return parts.length ? `${sep}${joined}` : sep;
  return joined;
}

function getTraktorPath(locationAttrs: Record<string, string>): string | undefined {
  const file = locationAttrs.FILE || "";
  if (!file) return undefined;

  const directory = normalizeTraktorPathPart(locationAttrs.DIR || "");
  const volume = normalizeTraktorPathPart(locationAttrs.VOLUME || "");
  const combined = directory
    ? `${directory.endsWith(sep) ? directory : `${directory}${sep}`}${file}`
    : file;

  if (isAbsolute(combined)) return combined;
  return volume ? join(volume, combined) : combined;
}

/**
 * Canonical form used to match a track against `PRIMARYKEY` references.
 *
 * The collection entry's path and the playlist's key are produced by different
 * code paths (and often by different operating systems), so they can differ in
 * separator style or letter case. Comparing canonical keys keeps the track's
 * metadata attached instead of silently falling back to a bare path.
 */
function normalizeTrackKey(value: string): string {
  const normalized = value.trim().replace(/[\\/]+/g, "/");
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function addTrackKeys(
  tracksByKey: Map<string, PlaylistImportTrack>,
  track: PlaylistImportTrack,
  keys: Array<string | undefined>,
): void {
  for (const key of keys) {
    if (key) tracksByKey.set(normalizeTrackKey(key), track);
  }
}

function parseTraktorNml(filePath: string, text: string): PlaylistImportParseResult {
  const tracksByKey = new Map<string, PlaylistImportTrack>();
  const collectionTracks: PlaylistImportTrack[] = [];

  for (const match of text.matchAll(/<ENTRY\b([^>]*)>([\s\S]*?)<\/ENTRY>/g)) {
    const entryAttrs = parseXmlAttributes(match[1]);
    const locationMatch = /<LOCATION\b([^>]*)\/?>/.exec(match[2]);
    if (!locationMatch) continue;

    const locationAttrs = parseXmlAttributes(locationMatch[1]);
    const albumAttrs = parseXmlAttributes(/<ALBUM\b([^>]*)\/?>/.exec(match[2])?.[1] || "");
    const infoAttrs = parseXmlAttributes(/<INFO\b([^>]*)\/?>/.exec(match[2])?.[1] || "");
    const tempoAttrs = parseXmlAttributes(/<TEMPO\b([^>]*)\/?>/.exec(match[2])?.[1] || "");
    const trackPath = getTraktorPath(locationAttrs);
    const track = compactTrack({
      path: trackPath,
      title: entryAttrs.TITLE,
      artist: entryAttrs.ARTIST,
      album: albumAttrs.TITLE,
      duration: numberOrUndefined(infoAttrs.PLAYTIME_FLOAT || infoAttrs.PLAYTIME),
      bpm: numberOrUndefined(tempoAttrs.BPM),
    });

    collectionTracks.push(track);
    addTrackKeys(tracksByKey, track, [
      trackPath,
      locationAttrs.FILE,
      `${locationAttrs.DIR || ""}${locationAttrs.FILE || ""}`,
      `${locationAttrs.VOLUME || ""}${locationAttrs.DIR || ""}${locationAttrs.FILE || ""}`,
    ]);
  }

  const playlists: PlaylistImportPlaylist[] = [];
  for (const match of text.matchAll(
    /<NODE\b([^>]*\bTYPE=["']PLAYLIST["'][^>]*)>([\s\S]*?)<\/NODE>/g,
  )) {
    const attrs = parseXmlAttributes(match[1]);
    const tracks = Array.from(match[2].matchAll(/<PRIMARYKEY\b([^>]*)\/?>/g))
      .map((primaryKeyMatch) => {
        const primaryKeyAttrs = parseXmlAttributes(primaryKeyMatch[1]);
        const key = primaryKeyAttrs.KEY;
        return key
          ? tracksByKey.get(normalizeTrackKey(key)) || { path: parsePathValue(key) }
          : null;
      })
      .filter((track): track is PlaylistImportTrack => Boolean(track));

    playlists.push({
      name: attrs.NAME || basename(filePath, extname(filePath)),
      tracks,
    });
  }

  if (playlists.length === 0 && collectionTracks.length > 0) {
    playlists.push({
      name: basename(filePath, extname(filePath)),
      tracks: collectionTracks,
    });
  }

  return { format: "traktor", playlists };
}

function decodeUtf16BeText(data: Buffer): string {
  let text = "";
  for (let index = 0; index + 1 < data.length; index += 2) {
    const code = data.readUInt16BE(index);
    if (code === 0 || code === 0xfeff) continue;
    text += String.fromCharCode(code);
  }
  return text.trim();
}

type SeratoRecord = {
  tag: string;
  data: Buffer;
  children: SeratoRecord[];
};

function parseSeratoRecords(buffer: Buffer, start = 0, end = buffer.length): SeratoRecord[] {
  const records: SeratoRecord[] = [];
  let offset = start;

  while (offset + 8 <= end) {
    const tag = buffer.toString("ascii", offset, offset + 4);
    const length = buffer.readUInt32BE(offset + 4);
    offset += 8;
    const nextOffset = offset + length;
    if (length < 0 || nextOffset > end) break;

    const data = buffer.subarray(offset, nextOffset);
    records.push({
      tag,
      data,
      children: tag.startsWith("o") ? parseSeratoRecords(data) : [],
    });
    offset = nextOffset;
  }

  return records;
}

function findSeratoTrackPaths(records: SeratoRecord[]): string[] {
  const paths: string[] = [];

  for (const record of records) {
    if (record.tag === "otrk") {
      const pathRecord = record.children.find((child) => child.tag === "ptrk");
      if (pathRecord) paths.push(decodeUtf16BeText(pathRecord.data));
      continue;
    }

    paths.push(...findSeratoTrackPaths(record.children));
  }

  return paths;
}

/**
 * Finds the crate's root directory by locating the `_Serato_/Subcrates` marker.
 *
 * The marker is matched with either separator because a crate exported on macOS
 * (`/Volumes/USB/_Serato_/Subcrates/…`) is often read on Windows and vice versa.
 */
function getSeratoCrateRoot(filePath: string): string {
  const markerPattern = /[\\/]_Serato_[\\/]Subcrates[\\/]/;
  const match = markerPattern.exec(filePath);
  return match ? filePath.slice(0, match.index) : dirname(filePath);
}

function parseSeratoCrate(filePath: string, bytes: Buffer): PlaylistImportParseResult {
  const crateRoot = getSeratoCrateRoot(filePath);
  const tracks = findSeratoTrackPaths(parseSeratoRecords(bytes))
    .filter(Boolean)
    .map((trackPath) =>
      compactTrack({
        path: parsePathValue(trackPath.replace(/\\/g, sep), crateRoot),
      }),
    );

  return {
    format: "serato-crate",
    playlists: [
      {
        name: basename(filePath, extname(filePath)),
        tracks,
      },
    ],
  };
}

export function parsePlaylistImportFile(
  filePath: string,
  bytes: Buffer,
): PlaylistImportParseResult {
  const extension = extname(filePath).toLowerCase();
  if (extension === ".crate") return parseSeratoCrate(filePath, bytes);

  const text = bytes.toString("utf8").replace(/^\uFEFF/, "");
  if (extension === ".json" || text.trimStart().startsWith("{")) {
    return parsePlayheadPlaylistJson(text);
  }
  if (extension === ".nml" || /<NML\b/i.test(text)) return parseTraktorNml(filePath, text);
  if (extension === ".xml" || /<DJ_PLAYLISTS\b/i.test(text))
    return parseRekordboxXml(filePath, text);
  if (extension === ".m3u" || extension === ".m3u8") {
    return parseM3uPlaylist(filePath, text, extension === ".m3u8" ? "m3u8" : "m3u");
  }

  throw new Error("Unsupported playlist file format.");
}
