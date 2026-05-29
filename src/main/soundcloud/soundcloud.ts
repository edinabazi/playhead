import { createHash, randomBytes } from "node:crypto";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  LibraryTrack,
  SoundCloudCollection,
  SoundCloudCollectionId,
  SoundCloudState,
  SoundCloudTranscoding,
} from "../../shared/library";
import { electron } from "../electron";
import { hasIntegrationsBroker, postIntegrationsBroker } from "../integrations-broker";

const { app, ipcMain, net, protocol, safeStorage, shell } = electron;

const apiRoot = "https://api.soundcloud.com";
const authRoot = "https://secure.soundcloud.com/authorize";
const tokenRoot = "https://secure.soundcloud.com/oauth/token";
const clientId = process.env.SOUNDCLOUD_CLIENT_ID || "";
const clientSecret = process.env.SOUNDCLOUD_CLIENT_SECRET || "";
const redirectUri = process.env.SOUNDCLOUD_REDIRECT_URI || "playhead://soundcloud/callback";
const maxAnalysisDurationSeconds = 480;
const maxAnalysisBytes = 36 * 1024 * 1024;
const soundCloudDebugEnabled = !app.isPackaged;

type SoundCloudSession = {
  username?: string;
  userId?: number;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  encrypted: boolean;
};

type SoundCloudStoredState = {
  pendingState?: string;
  pendingCodeVerifier?: string;
  session?: SoundCloudSession;
  lastError?: string;
};

type SoundCloudUser = {
  id: number;
  username: string;
};

type SoundCloudTrackTranscoding = {
  url?: string;
  preset?: string;
  quality?: string;
  snipped?: boolean;
  duration?: number;
  format?: { protocol?: string; mime_type?: string };
};

type SoundCloudTrack = {
  id: number;
  urn?: string;
  title: string;
  duration?: number;
  streamable?: boolean;
  stream_url?: string;
  access?: "playable" | "preview" | "blocked";
  artwork_url?: string;
  waveform_url?: string;
  permalink_url?: string;
  track_authorization?: string;
  media?: { transcodings?: SoundCloudTrackTranscoding[] };
  user?: { username?: string; avatar_url?: string };
};

type SoundCloudPlaylist = {
  id: number | string;
  urn?: string;
  title: string;
  track_count?: number;
  tracks?: Array<Partial<SoundCloudTrack> & { id?: number | string; urn?: string }>;
  user?: { username?: string };
};

type Paginated<T> = {
  collection?: T[];
  next_href?: string | null;
};

type SoundCloudStreamResponse = {
  url?: string;
  location?: string;
  status?: string;
  hls_aac_160_url?: string;
  hls_aac_96_url?: string;
  hls_opus_64_url?: string;
  http_mp3_128_url?: string;
  hls_mp3_128_url?: string;
  preview_mp3_128_url?: string;
  collection?: Array<{
    url?: string;
    preset?: string;
    quality?: string;
    snipped?: boolean;
    duration?: number;
    format?: { protocol?: string; mime_type?: string };
  }>;
};

type SoundCloudWaveformResponse = {
  width?: number;
  height?: number;
  samples?: number[];
};

type SoundCloudTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

type HlsPart = {
  url: string;
  byteRange?: string;
  duration?: number;
};

type HlsVariant = {
  url: string;
  bandwidth: number;
};

type HlsPlaylist = {
  map?: HlsPart;
  segments: HlsPart[];
  variants: HlsVariant[];
};

function debugSoundCloud(message: string, details?: Record<string, unknown>): void {
  if (!soundCloudDebugEnabled) return;
  if (details) console.log(`[SoundCloud] ${message}`, details);
  else console.log(`[SoundCloud] ${message}`);
}

function parseJson<T>(raw: string): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function encodeImageUrl(url: string): string {
  return Buffer.from(url, "utf8").toString("base64url");
}

function decodeImageUrl(url: string): string {
  const encodedUrl = new URL(url).pathname.slice(1);
  return Buffer.from(encodedUrl, "base64url").toString("utf8");
}

function createSoundCloudImageUrl(url: string): string {
  return `playhead-soundcloud-image://image/${encodeImageUrl(url)}`;
}

function createSoundCloudAudioUrl(url: string): string {
  return `playhead-soundcloud-audio://audio/${encodeImageUrl(url)}`;
}

function createSoundCloudWaveformJsonUrl(url: string): string | null {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") return null;
    if (!parsedUrl.hostname.endsWith(".sndcdn.com") && parsedUrl.hostname !== "sndcdn.com") {
      return null;
    }
    if (parsedUrl.pathname.endsWith(".png")) {
      parsedUrl.pathname = parsedUrl.pathname.slice(0, -4) + ".json";
    } else if (!parsedUrl.pathname.endsWith(".json")) {
      return null;
    }
    return parsedUrl.toString();
  } catch {
    return null;
  }
}

function mapSoundCloudWaveformPeaks(data: SoundCloudWaveformResponse): number[][] | null {
  const samples = Array.isArray(data.samples) ? data.samples : [];
  if (!samples.length) return null;
  const finiteSamples = samples
    .map((sample) => (Number.isFinite(sample) ? Math.max(0, sample) : 0))
    .filter((sample) => sample > 0);
  if (!finiteSamples.length) return null;

  const sortedSamples = [...finiteSamples].sort((a, b) => a - b);
  const percentile = (value: number) =>
    sortedSamples[
      Math.min(sortedSamples.length - 1, Math.max(0, Math.floor(value * sortedSamples.length)))
    ] || 0;
  const floor = percentile(0.12);
  const ceiling = Math.max(floor + 1, percentile(0.98));
  const peaks: number[] = [];

  for (const sample of samples) {
    const normalized = Math.max(
      0,
      Math.min(1, ((Number.isFinite(sample) ? sample : 0) - floor) / (ceiling - floor)),
    );
    const amplitude = Math.pow(normalized, 1.7);
    peaks.push(amplitude);
  }

  return [peaks];
}

function encodeResourceId(id: number | string): string {
  return encodeURIComponent(String(id));
}

function getPlaylistResourceId(playlist: SoundCloudPlaylist): string {
  return String(playlist.urn || playlist.id);
}

function getTrackResourceId(
  track: Partial<SoundCloudTrack> & { id?: number | string },
): string | null {
  if (track.id !== undefined && track.id !== null) return String(track.id);
  return track.urn || null;
}

function hasTrackMetadata(track: Partial<SoundCloudTrack>): track is SoundCloudTrack {
  return Boolean(track.id !== undefined && track.id !== null && track.title);
}

function isPreviewStreamUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return (
      parsedUrl.hostname.includes("cf-preview-media") || parsedUrl.pathname.includes("/preview")
    );
  } catch {
    return url.includes("cf-preview-media") || url.includes("/preview");
  }
}

function isHlsStreamUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return (
      parsedUrl.pathname.includes(".m3u8") ||
      parsedUrl.pathname.includes("/playlist/") ||
      parsedUrl.pathname.endsWith("/hls") ||
      parsedUrl.pathname.includes("/hls/")
    );
  } catch {
    return (
      url.includes(".m3u8") ||
      url.includes("/playlist/") ||
      url.endsWith("/hls") ||
      url.includes("/hls/")
    );
  }
}

function isSoundCloudApiUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return (
      parsedUrl.hostname === "api.soundcloud.com" || parsedUrl.hostname === "api-v2.soundcloud.com"
    );
  } catch {
    return url.startsWith("https://api") || url.includes("/stream/");
  }
}

function shouldResolveStreamUrl(url: string): boolean {
  return isSoundCloudApiUrl(url) || url.includes("/stream/");
}

function isRedirectStatus(status: number): boolean {
  return status >= 300 && status < 400;
}

function soundCloudApiFetch(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, init);
}

function soundCloudAssetFetch(url: string, init?: RequestInit): Promise<Response> {
  return net.fetch(url, init);
}

function appendSoundCloudStreamParams(url: string, trackAuthorization?: string): string {
  try {
    const parsedUrl = new URL(url);
    if (
      parsedUrl.hostname !== "api.soundcloud.com" &&
      parsedUrl.hostname !== "api-v2.soundcloud.com"
    ) {
      return url;
    }
    if (trackAuthorization && !parsedUrl.searchParams.has("track_authorization")) {
      parsedUrl.searchParams.set("track_authorization", trackAuthorization);
    }
    return parsedUrl.toString();
  } catch {
    return url;
  }
}

function toAbsoluteUrl(url: string, baseUrl: string): string {
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return url;
  }
}

function parseHlsAttributes(line: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const rawAttributes = line.slice(line.indexOf(":") + 1);
  const matches = rawAttributes.matchAll(/([A-Z0-9-]+)=("[^"]*"|[^,]*)/g);
  for (const match of matches) {
    attributes[match[1]] = match[2].replace(/^"|"$/g, "");
  }
  return attributes;
}

function parseHlsPlaylist(raw: string, playlistUrl: string): HlsPlaylist {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const variants: HlsVariant[] = [];
  const segments: HlsPart[] = [];
  let map: HlsPart | undefined;
  let pendingVariantBandwidth: number | null = null;
  let pendingSegmentDuration: number | undefined;
  let pendingByteRange: string | undefined;

  for (const line of lines) {
    if (line.startsWith("#EXT-X-STREAM-INF:")) {
      const bandwidth = Number.parseInt(parseHlsAttributes(line).BANDWIDTH || "0", 10);
      pendingVariantBandwidth = Number.isFinite(bandwidth) ? bandwidth : 0;
      continue;
    }
    if (line.startsWith("#EXT-X-MAP:")) {
      const attributes = parseHlsAttributes(line);
      if (attributes.URI) {
        map = {
          url: toAbsoluteUrl(attributes.URI, playlistUrl),
          byteRange: attributes.BYTERANGE,
        };
      }
      continue;
    }
    if (line.startsWith("#EXT-X-BYTERANGE:")) {
      pendingByteRange = line.slice("#EXT-X-BYTERANGE:".length).trim();
      continue;
    }
    if (line.startsWith("#EXTINF:")) {
      const duration = Number.parseFloat(line.slice("#EXTINF:".length).split(",")[0]);
      pendingSegmentDuration = Number.isFinite(duration) ? duration : undefined;
      continue;
    }
    if (line.startsWith("#")) continue;

    const url = toAbsoluteUrl(line, playlistUrl);
    if (pendingVariantBandwidth !== null) {
      variants.push({ url, bandwidth: pendingVariantBandwidth });
      pendingVariantBandwidth = null;
      continue;
    }

    segments.push({
      url,
      byteRange: pendingByteRange,
      duration: pendingSegmentDuration,
    });
    pendingByteRange = undefined;
    pendingSegmentDuration = undefined;
  }

  return { map, segments, variants };
}

function getRangeHeader(
  part: HlsPart,
  previousByteEndByUrl: Map<string, number>,
): string | undefined {
  if (!part.byteRange) return undefined;
  const match = part.byteRange.match(/^(\d+)(?:@(\d+))?$/);
  if (!match) return undefined;
  const length = Number.parseInt(match[1], 10);
  const offset =
    match[2] !== undefined
      ? Number.parseInt(match[2], 10)
      : (previousByteEndByUrl.get(part.url) ?? -1) + 1;
  if (!Number.isFinite(length) || !Number.isFinite(offset) || length <= 0 || offset < 0) {
    return undefined;
  }
  const end = offset + length - 1;
  previousByteEndByUrl.set(part.url, end);
  return `bytes=${offset}-${end}`;
}

function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
  const arrayBuffer = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(arrayBuffer).set(buffer);
  return arrayBuffer;
}

function chooseStreamResponseUrl(data: SoundCloudStreamResponse): string | null {
  const collection = data.collection || [];
  const collectionCandidates = [
    collection.find(
      (item) =>
        !item.snipped &&
        item.format?.protocol === "hls" &&
        (item.format.mime_type?.includes("aac") || item.format.mime_type?.includes("mp4")),
    )?.url,
    collection.find((item) => !item.snipped && item.format?.protocol === "hls")?.url,
    collection.find((item) => !item.snipped && item.format?.protocol === "progressive")?.url,
    collection.find(
      (item) =>
        item.format?.protocol === "hls" &&
        (item.format.mime_type?.includes("aac") || item.format.mime_type?.includes("mp4")),
    )?.url,
    collection.find((item) => item.format?.protocol === "hls")?.url,
    collection.find((item) => item.format?.protocol === "progressive")?.url,
    collection[0]?.url,
  ];
  const candidates = [
    data.hls_aac_160_url,
    data.hls_aac_96_url,
    data.hls_opus_64_url,
    data.hls_mp3_128_url,
    data.url,
    data.http_mp3_128_url,
    ...collectionCandidates,
  ].filter((url): url is string => Boolean(url));
  return (
    candidates.find((url) => !isPreviewStreamUrl(url)) ||
    data.preview_mp3_128_url ||
    data.url ||
    null
  );
}

async function resolveSoundCloudStreamEndpoint(
  url: string,
  accessToken: string,
  trackAuthorization?: string,
  failures?: string[],
): Promise<string | null> {
  const requestUrl = appendSoundCloudStreamParams(url, trackAuthorization);
  let response: Response;
  try {
    response = await soundCloudAssetFetch(requestUrl, {
      redirect: "follow",
      headers: {
        Accept: "application/json; charset=utf-8",
        Authorization: `OAuth ${accessToken}`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "request failed";
    failures?.push(`${new URL(requestUrl).pathname}: ${message}`);
    return null;
  }
  const contentType = response.headers.get("content-type") || "";
  if (
    response.ok &&
    (contentType.startsWith("audio/") ||
      contentType.includes("mpegurl") ||
      contentType.includes("vnd.apple.mpegurl"))
  ) {
    return response.url && !isSoundCloudApiUrl(response.url) ? response.url : requestUrl;
  }

  const raw = await response.text().catch(() => "");
  const data = parseJson<SoundCloudStreamResponse>(raw);

  if (isRedirectStatus(response.status)) {
    const location = response.headers.get("location") || data?.location;
    if (location) return toAbsoluteUrl(location, requestUrl);
    failures?.push(`${new URL(requestUrl).pathname}: redirect without location`);
    return null;
  }

  if (response.status === 202 && response.headers.get("x-amzn-waf-action") === "challenge") {
    failures?.push(`${new URL(requestUrl).pathname}: SoundCloud WAF challenge`);
    return null;
  }
  if (!response.ok || !data) {
    failures?.push(`${new URL(requestUrl).pathname}: ${response.status} ${contentType || "empty"}`);
    return null;
  }
  return chooseStreamResponseUrl(data);
}

function statePath(): string {
  return join(app.getPath("userData"), "soundcloud.json");
}

function isConfigured(): boolean {
  return hasIntegrationsBroker() || Boolean(clientId && clientSecret);
}

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function encryptSecret(value: string): string {
  if (!safeStorage?.isEncryptionAvailable()) return value;
  return safeStorage.encryptString(value).toString("base64");
}

function decryptSecret(value: string, encrypted: boolean): string {
  if (!encrypted) return value;
  return safeStorage.decryptString(Buffer.from(value, "base64"));
}

async function readStoredState(): Promise<SoundCloudStoredState> {
  return readJson<SoundCloudStoredState>(statePath(), {});
}

async function writeStoredState(state: SoundCloudStoredState): Promise<void> {
  await writeJson(statePath(), state);
}

async function setLastError(message?: string): Promise<void> {
  const state = await readStoredState();
  await writeStoredState({ ...state, lastError: message });
}

export async function getSoundCloudState(): Promise<SoundCloudState> {
  const state = await readStoredState();
  return {
    configured: isConfigured(),
    connected: Boolean(state.session),
    username: state.session?.username,
    pendingAuth: Boolean(state.pendingState),
    lastError: state.lastError,
  };
}

function createCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

function createAuthUrl(state: string, codeVerifier: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    state,
    code_challenge: createCodeChallenge(codeVerifier),
    code_challenge_method: "S256",
  });
  return `${authRoot}?${params.toString()}`;
}

async function exchangeToken(params: Record<string, string>): Promise<SoundCloudSession | null> {
  let data: SoundCloudTokenResponse | null;

  if (hasIntegrationsBroker()) {
    try {
      data = await postIntegrationsBroker<SoundCloudTokenResponse>("/soundcloud/token", {
        grantType: params.grant_type,
        code: params.code,
        codeVerifier: params.code_verifier,
        refreshToken: params.refresh_token,
      });
    } catch (error) {
      await setLastError(error instanceof Error ? error.message : "SoundCloud auth failed.");
      return null;
    }
  } else {
    const response = await soundCloudApiFetch(tokenRoot, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        ...params,
      }),
    });
    data = (await response.json().catch(() => null)) as SoundCloudTokenResponse | null;

    if (!response.ok) {
      await setLastError(data?.error_description || data?.error || "SoundCloud auth failed.");
      return null;
    }
  }

  if (!data?.access_token) {
    await setLastError(data?.error_description || data?.error || "SoundCloud auth failed.");
    return null;
  }

  const encrypted = Boolean(safeStorage?.isEncryptionAvailable());
  return {
    accessToken: encryptSecret(data.access_token),
    refreshToken: data.refresh_token ? encryptSecret(data.refresh_token) : undefined,
    expiresAt: Date.now() + Math.max(60, data.expires_in || 3600) * 1000,
    encrypted,
  };
}

async function getAccessToken(): Promise<string | null> {
  const state = await readStoredState();
  const session = state.session;
  if (!session) return null;

  try {
    if (Date.now() < session.expiresAt - 60_000) {
      return decryptSecret(session.accessToken, session.encrypted);
    }

    const refreshToken = session.refreshToken
      ? decryptSecret(session.refreshToken, session.encrypted)
      : null;
    if (!refreshToken) return decryptSecret(session.accessToken, session.encrypted);

    const refreshed = await exchangeToken({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });
    if (!refreshed) return null;
    await writeStoredState({
      ...state,
      session: {
        ...session,
        ...refreshed,
        username: session.username,
        userId: session.userId,
      },
      lastError: undefined,
    });
    return decryptSecret(refreshed.accessToken, refreshed.encrypted);
  } catch {
    await writeStoredState({
      ...state,
      session: undefined,
      lastError: "SoundCloud session expired.",
    });
    return null;
  }
}

async function getSoundCloud<T>(pathOrUrl: string): Promise<T | null> {
  const accessToken = await getAccessToken();
  if (!accessToken) return null;
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${apiRoot}${pathOrUrl}`;
  const response = await soundCloudApiFetch(url, {
    headers: { Accept: "application/json; charset=utf-8", Authorization: `OAuth ${accessToken}` },
  });
  const raw = await response.text();
  const data = parseJson<T>(raw);
  if (!response.ok) {
    const errorMessage =
      data && typeof data === "object" && "message" in data
        ? String((data as { message?: unknown }).message)
        : `SoundCloud request failed (${response.status}).`;
    await setLastError(errorMessage);
    return null;
  }
  await setLastError(undefined);
  return data;
}

async function getAllPages<T>(path: string): Promise<T[]> {
  let nextUrl: string | null =
    `${apiRoot}${path}${path.includes("?") ? "&" : "?"}linked_partitioning=1&limit=50`;
  const items: T[] = [];
  while (nextUrl) {
    const page = await getSoundCloud<Paginated<T> | T[]>(nextUrl);
    if (!page) break;
    if (Array.isArray(page)) {
      items.push(...page);
      break;
    }
    items.push(...(page.collection || []));
    nextUrl = page.next_href || null;
  }
  return items;
}

function mapTranscoding(transcoding: SoundCloudTrackTranscoding): SoundCloudTranscoding | null {
  if (!transcoding.url) return null;
  return {
    url: transcoding.url,
    protocol: transcoding.format?.protocol,
    mimeType: transcoding.format?.mime_type,
    preset: transcoding.preset,
    quality: transcoding.quality,
    snipped: transcoding.snipped,
    duration: transcoding.duration,
  };
}

function mapTrack(track: SoundCloudTrack): LibraryTrack {
  const artworkUrl = track.artwork_url || track.user?.avatar_url;
  return {
    id: `soundcloud:${track.id}`,
    source: "soundcloud",
    path: `soundcloud:${track.id}`,
    fileName: `${track.id}`,
    title: track.title || "Untitled",
    artist: track.user?.username || "SoundCloud",
    duration: Math.max(0, Math.round((track.duration || 0) / 1000)),
    folderId: "soundcloud",
    artwork: artworkUrl
      ? { mimeType: "image/jpeg", src: createSoundCloudImageUrl(artworkUrl) }
      : undefined,
    audioFormat: "SoundCloud",
    soundcloud: {
      id: track.id,
      urn: track.urn,
      permalinkUrl: track.permalink_url,
      streamUrl: track.stream_url,
      trackAuthorization: track.track_authorization,
      transcodings: (track.media?.transcodings || [])
        .map(mapTranscoding)
        .filter((transcoding): transcoding is SoundCloudTranscoding => Boolean(transcoding)),
      streamable: Boolean(track.streamable),
      access: track.access,
      artworkUrl,
      waveformUrl: track.waveform_url,
      username: track.user?.username,
    },
  };
}

async function getTracksByIds(trackIds: string[]): Promise<SoundCloudTrack[]> {
  const uniqueTrackIds = [...new Set(trackIds)].filter(Boolean);
  const tracksById = new Map<string, SoundCloudTrack>();
  const numericTrackIds = uniqueTrackIds.filter((id) => /^\d+$/.test(id));
  const urnTrackIds = uniqueTrackIds.filter((id) => !/^\d+$/.test(id));

  for (let index = 0; index < numericTrackIds.length; index += 50) {
    const chunk = numericTrackIds.slice(index, index + 50);
    const tracks = await getAllPages<SoundCloudTrack>(
      `/tracks?ids=${chunk.map(encodeURIComponent).join(",")}&access=playable,preview,blocked`,
    );
    for (const track of tracks) {
      tracksById.set(String(track.id), track);
      if (track.urn) tracksById.set(track.urn, track);
    }
  }

  for (const urn of urnTrackIds) {
    const track = await getSoundCloud<SoundCloudTrack>(`/tracks/${encodeResourceId(urn)}`);
    if (track) {
      tracksById.set(urn, track);
      tracksById.set(String(track.id), track);
      if (track.urn) tracksById.set(track.urn, track);
    }
  }

  return uniqueTrackIds.flatMap((id) => {
    const track = tracksById.get(id);
    return track ? [track] : [];
  });
}

async function expandPlaylistTrackStubs(
  tracks: SoundCloudPlaylist["tracks"] = [],
): Promise<SoundCloudTrack[]> {
  const fullTracks: SoundCloudTrack[] = [];
  const trackIdsToLoad: string[] = [];

  for (const track of tracks) {
    if (hasTrackMetadata(track)) {
      fullTracks.push(track);
      continue;
    }

    const trackId = getTrackResourceId(track);
    if (trackId) trackIdsToLoad.push(trackId);
  }

  if (!trackIdsToLoad.length) return fullTracks;

  const loadedTracks = await getTracksByIds(trackIdsToLoad);
  const loadedTracksById = new Map<string, SoundCloudTrack>();
  for (const track of loadedTracks) {
    loadedTracksById.set(String(track.id), track);
    if (track.urn) loadedTracksById.set(track.urn, track);
  }

  const resolvedTracks: SoundCloudTrack[] = [];
  for (const track of tracks) {
    if (hasTrackMetadata(track)) {
      resolvedTracks.push(track);
      continue;
    }

    const trackId = getTrackResourceId(track);
    const loadedTrack = trackId ? loadedTracksById.get(trackId) : null;
    if (loadedTrack) resolvedTracks.push(loadedTrack);
  }

  return resolvedTracks;
}

async function getPlaylistTracks(playlistResourceId: string): Promise<LibraryTrack[]> {
  const encodedPlaylistId = encodeResourceId(playlistResourceId);
  const tracks = await getAllPages<SoundCloudTrack>(
    `/playlists/${encodedPlaylistId}/tracks?access=playable,preview,blocked`,
  );
  if (tracks.length) return tracks.map(mapTrack);

  const playlist = await getSoundCloud<SoundCloudPlaylist>(`/playlists/${encodedPlaylistId}`);
  const expandedTracks = await expandPlaylistTrackStubs(playlist?.tracks);
  if (expandedTracks.length) return expandedTracks.map(mapTrack);
  if (playlist?.track_count && playlist.track_count > 0) {
    throw new Error(`SoundCloud returned no tracks for "${playlist.title}".`);
  }

  return [];
}

async function getTracksFromPlaylists(playlists: SoundCloudPlaylist[]): Promise<LibraryTrack[]> {
  const tracks: LibraryTrack[] = [];
  for (const playlist of playlists) {
    tracks.push(...(await getPlaylistTracks(getPlaylistResourceId(playlist))));
  }
  return tracks;
}

export async function startSoundCloudAuth(): Promise<SoundCloudState> {
  if (!isConfigured()) return getSoundCloudState();
  const state = await readStoredState();
  const pendingState = randomBytes(18).toString("base64url");
  const pendingCodeVerifier = randomBytes(48).toString("base64url");
  await writeStoredState({ ...state, pendingState, pendingCodeVerifier, lastError: undefined });
  if (hasIntegrationsBroker()) {
    try {
      const response = await postIntegrationsBroker<{ authUrl: string }>("/soundcloud/auth-url", {
        state: pendingState,
        codeChallenge: createCodeChallenge(pendingCodeVerifier),
      });
      await shell.openExternal(response.authUrl);
    } catch (error) {
      await writeStoredState({
        ...state,
        pendingState: undefined,
        pendingCodeVerifier: undefined,
        lastError: error instanceof Error ? error.message : "SoundCloud auth failed.",
      });
    }
  } else {
    await shell.openExternal(createAuthUrl(pendingState, pendingCodeVerifier));
  }
  return getSoundCloudState();
}

export async function completeSoundCloudAuth(
  code: string,
  returnedState?: string,
): Promise<SoundCloudState> {
  const state = await readStoredState();
  if (!state.pendingState) return getSoundCloudState();
  if (returnedState && returnedState !== state.pendingState) {
    await setLastError("SoundCloud auth state did not match.");
    return getSoundCloudState();
  }

  const session = await exchangeToken({
    grant_type: "authorization_code",
    code,
    code_verifier: state.pendingCodeVerifier || "",
  });
  if (!session) return getSoundCloudState();
  const accessToken = decryptSecret(session.accessToken, session.encrypted);
  const meResponse = await soundCloudApiFetch(`${apiRoot}/me`, {
    headers: { Authorization: `OAuth ${accessToken}` },
  });
  const me = meResponse.ok ? ((await meResponse.json()) as SoundCloudUser) : null;

  await writeStoredState({
    session: {
      ...session,
      username: me?.username,
      userId: me?.id,
    },
  });
  return getSoundCloudState();
}

export async function disconnectSoundCloud(): Promise<SoundCloudState> {
  await rm(statePath(), { force: true });
  return getSoundCloudState();
}

export async function getSoundCloudCollections(
  visibleCollections: SoundCloudCollectionId[],
): Promise<SoundCloudCollection[]> {
  const visible = new Set(visibleCollections);
  const collections: SoundCloudCollection[] = [];

  if (visible.has("playlists")) {
    const playlists = await getAllPages<SoundCloudPlaylist>("/me/playlists");
    collections.push(
      ...playlists.map((playlist) => ({
        id: `playlist:${getPlaylistResourceId(playlist)}` as const,
        title: playlist.title,
        subtitle: playlist.user?.username,
        trackCount: playlist.track_count,
        kind: "tracks" as const,
      })),
    );
  }
  if (visible.has("liked-tracks")) {
    collections.push({ id: "liked-tracks", title: "Loved Tracks", kind: "tracks" });
  }
  if (visible.has("liked-playlists")) {
    collections.push({ id: "liked-playlists", title: "Liked Playlists", kind: "playlists" });
  }
  if (visible.has("uploads")) {
    collections.push({ id: "uploads", title: "Uploads", kind: "tracks" });
  }
  if (visible.has("reposted-tracks")) {
    collections.push({ id: "reposted-tracks", title: "Reposted Tracks", kind: "tracks" });
  }
  if (visible.has("reposted-playlists")) {
    collections.push({ id: "reposted-playlists", title: "Reposted Playlists", kind: "playlists" });
  }
  if (visible.has("feed")) {
    collections.push({ id: "feed", title: "Following Feed", kind: "feed" });
  }

  return collections;
}

export async function getSoundCloudCollectionTracks(collectionId: string): Promise<LibraryTrack[]> {
  if (collectionId.startsWith("playlist:")) {
    return getPlaylistTracks(collectionId.slice("playlist:".length));
  }

  if (collectionId === "liked-tracks") {
    return (await getAllPages<SoundCloudTrack>("/me/likes/tracks")).map(mapTrack);
  }
  if (collectionId === "uploads") {
    return (await getAllPages<SoundCloudTrack>("/me/tracks")).map(mapTrack);
  }
  if (collectionId === "reposted-tracks") {
    return (await getAllPages<SoundCloudTrack>("/me/reposts/tracks")).map(mapTrack);
  }
  if (collectionId === "feed") {
    return (await getAllPages<SoundCloudTrack>("/me/feed")).map(mapTrack);
  }
  if (collectionId === "liked-playlists") {
    const playlists = await getAllPages<SoundCloudPlaylist>("/me/likes/playlists");
    return getTracksFromPlaylists(playlists);
  }
  if (collectionId === "reposted-playlists") {
    const playlists = await getAllPages<SoundCloudPlaylist>("/me/reposts/playlists");
    return getTracksFromPlaylists(playlists);
  }

  return [];
}

function orderSoundCloudTranscodings(
  transcodings?: SoundCloudTranscoding[],
): SoundCloudTranscoding[] {
  const available = (transcodings || []).filter((transcoding) => transcoding.url);
  if (!available.length) return [];
  const buckets = [
    available.filter(
      (transcoding) => !transcoding.snipped && transcoding.protocol === "progressive",
    ),
    available.filter(
      (transcoding) =>
        !transcoding.snipped &&
        transcoding.protocol === "hls" &&
        (transcoding.mimeType?.includes("aac") ||
          transcoding.mimeType?.includes("mp4") ||
          transcoding.preset?.includes("aac")),
    ),
    available.filter((transcoding) => !transcoding.snipped && transcoding.protocol === "hls"),
    available.filter((transcoding) => transcoding.protocol === "progressive"),
    available.filter(
      (transcoding) =>
        transcoding.protocol === "hls" &&
        (transcoding.mimeType?.includes("aac") ||
          transcoding.mimeType?.includes("mp4") ||
          transcoding.preset?.includes("aac")),
    ),
    available.filter((transcoding) => transcoding.protocol === "hls"),
    available,
  ];
  const seenUrls = new Set<string>();
  return buckets.flatMap((bucket) =>
    bucket.filter((transcoding) => {
      if (seenUrls.has(transcoding.url)) return false;
      seenUrls.add(transcoding.url);
      return true;
    }),
  );
}

function uniqueUrls(urls: Array<string | undefined>): string[] {
  return [...new Set(urls.filter((url): url is string => Boolean(url)))];
}

function soundCloudTrackStreamsUrl(trackResourceId: string | number): string {
  return `${apiRoot}/tracks/${encodeURIComponent(String(trackResourceId))}/streams`;
}

async function resolvePlayableStreamUrl(
  url: string,
  accessToken: string,
  trackAuthorization?: string,
  failures?: string[],
): Promise<string | null> {
  const resolvedUrl = await resolveSoundCloudStreamEndpoint(
    url,
    accessToken,
    trackAuthorization,
    failures,
  );
  if (!resolvedUrl) return null;
  if (!shouldResolveStreamUrl(resolvedUrl)) return resolvedUrl;
  return resolveSoundCloudStreamEndpoint(resolvedUrl, accessToken, trackAuthorization, failures);
}

async function fetchSoundCloudAudioBytes(
  part: HlsPart,
  previousByteEndByUrl: Map<string, number>,
): Promise<Buffer> {
  const headers = new Headers();
  const range = getRangeHeader(part, previousByteEndByUrl);
  if (range) headers.set("Range", range);

  const response = await soundCloudAssetFetch(part.url, { headers });
  if (!response.ok) throw new Error(`SoundCloud audio segment failed (${response.status}).`);
  return Buffer.from(await response.arrayBuffer());
}

async function fetchSoundCloudProgressiveBytes(
  url: string,
  accessToken: string,
): Promise<ArrayBuffer | null> {
  debugSoundCloud("BPM analysis fetching progressive stream", { url });
  const headers = new Headers();
  if (isSoundCloudApiUrl(url)) headers.set("Authorization", `OAuth ${accessToken}`);
  const response = await soundCloudAssetFetch(url, { headers });
  if (!response.ok) {
    debugSoundCloud("BPM analysis progressive fetch failed", { status: response.status });
    return null;
  }
  const contentLength = Number.parseInt(response.headers.get("content-length") || "0", 10);
  if (Number.isFinite(contentLength) && contentLength > maxAnalysisBytes) {
    debugSoundCloud("BPM analysis progressive stream skipped: too large", { contentLength });
    return null;
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  debugSoundCloud("BPM analysis progressive stream fetched", { bytes: buffer.byteLength });
  if (buffer.byteLength > maxAnalysisBytes) {
    debugSoundCloud("BPM analysis progressive stream skipped after fetch: too large", {
      bytes: buffer.byteLength,
    });
    return null;
  }
  return bufferToArrayBuffer(buffer);
}

async function fetchSoundCloudHlsBytes(
  playlistUrl: string,
  accessToken: string,
  depth = 0,
): Promise<ArrayBuffer | null> {
  if (depth > 2) return null;

  debugSoundCloud("BPM analysis fetching HLS playlist", { playlistUrl, depth });
  const headers = new Headers();
  if (isSoundCloudApiUrl(playlistUrl)) headers.set("Authorization", `OAuth ${accessToken}`);
  const response = await soundCloudAssetFetch(playlistUrl, { headers });
  if (!response.ok) {
    debugSoundCloud("BPM analysis HLS playlist fetch failed", {
      playlistUrl,
      status: response.status,
    });
    return null;
  }
  const playlist = parseHlsPlaylist(await response.text(), playlistUrl);
  debugSoundCloud("BPM analysis parsed HLS playlist", {
    playlistUrl,
    variants: playlist.variants.length,
    segments: playlist.segments.length,
    hasMap: Boolean(playlist.map),
  });

  if (playlist.variants.length > 0) {
    const variants = playlist.variants
      .slice()
      .sort((a, b) => (a.bandwidth || Number.MAX_SAFE_INTEGER) - (b.bandwidth || Number.MAX_SAFE_INTEGER));
    for (const variant of variants) {
      debugSoundCloud("BPM analysis trying HLS variant", {
        url: variant.url,
        bandwidth: variant.bandwidth,
      });
      const bytes = await fetchSoundCloudHlsBytes(variant.url, accessToken, depth + 1);
      if (bytes) return bytes;
    }
    return null;
  }

  if (playlist.segments.length === 0) return null;

  const chunks: Buffer[] = [];
  let totalBytes = 0;
  let totalDuration = 0;
  const previousByteEndByUrl = new Map<string, number>();

  const parts = playlist.map ? [playlist.map, ...playlist.segments] : playlist.segments;
  for (const part of parts) {
    if (part.duration && totalDuration >= maxAnalysisDurationSeconds) break;
    const chunk = await fetchSoundCloudAudioBytes(part, previousByteEndByUrl);
    totalBytes += chunk.byteLength;
    debugSoundCloud("BPM analysis fetched HLS part", {
      bytes: chunk.byteLength,
      totalBytes,
      totalDuration,
      duration: part.duration,
      byteRange: part.byteRange,
    });
    if (totalBytes > maxAnalysisBytes) {
      debugSoundCloud("BPM analysis HLS skipped: too large", { totalBytes });
      return null;
    }
    chunks.push(chunk);
    totalDuration += part.duration || 0;
  }

  if (chunks.length === 0) return null;
  debugSoundCloud("BPM analysis HLS audio assembled", {
    chunks: chunks.length,
    totalBytes,
    totalDuration,
  });
  return bufferToArrayBuffer(Buffer.concat(chunks));
}

export async function getSoundCloudStreamUrl(
  trackId: number,
  fallbackStreamUrl?: string,
  fallbackTranscodings?: SoundCloudTranscoding[],
  fallbackTrackAuthorization?: string,
): Promise<string> {
  const track = await getSoundCloud<SoundCloudTrack>(`/tracks/${trackId}`);
  if (
    track &&
    (track.streamable === false || track.access === "blocked" || track.access === "preview")
  ) {
    throw new Error("This SoundCloud track is not available for full playback.");
  }
  const userAccessToken = await getAccessToken();
  if (!userAccessToken) throw new Error("SoundCloud is not connected.");

  const trackAuthorization = track?.track_authorization || fallbackTrackAuthorization;
  const trackTranscodings = track?.media?.transcodings
    ?.map(mapTranscoding)
    .filter((transcoding): transcoding is SoundCloudTranscoding => Boolean(transcoding));
  const transcodings = orderSoundCloudTranscodings(
    trackTranscodings?.length ? trackTranscodings : fallbackTranscodings,
  );
  const trackStreamApiUrls = uniqueUrls([track?.urn, String(trackId)]).map((trackResourceId) =>
    soundCloudTrackStreamsUrl(trackResourceId),
  );
  const candidateUrls = uniqueUrls([
    ...trackStreamApiUrls,
    ...transcodings.map((transcoding) => transcoding.url),
    track?.stream_url,
    fallbackStreamUrl,
  ]);

  if (!candidateUrls.length) {
    throw new Error("SoundCloud did not return a playable stream URL for this track.");
  }

  let sawPreview = false;
  const failures: string[] = [];
  for (const candidateUrl of candidateUrls) {
    const finalUrl = await resolvePlayableStreamUrl(
      candidateUrl,
      userAccessToken,
      trackAuthorization,
      failures,
    );
    if (!finalUrl) continue;
    if (isPreviewStreamUrl(finalUrl)) {
      sawPreview = true;
      continue;
    }
    return isHlsStreamUrl(finalUrl) && !isSoundCloudApiUrl(finalUrl)
      ? finalUrl
      : createSoundCloudAudioUrl(finalUrl);
  }

  if (sawPreview) {
    throw new Error("SoundCloud only returned a 30 second preview for this track.");
  }
  if (failures.some((failure) => failure.includes("SoundCloud WAF challenge"))) {
    throw new Error(
      "SoundCloud temporarily challenged stream requests. Wait a minute, then try playback again.",
    );
  }
  const failureDetail = failures.length ? ` Last response: ${failures.at(-1)}.` : "";
  throw new Error(`SoundCloud stream is unavailable for track ${trackId}.${failureDetail}`);
}

export async function getSoundCloudProgressiveStreamUrl(
  trackId: number,
  fallbackTranscodings?: SoundCloudTranscoding[],
  fallbackTrackAuthorization?: string,
): Promise<string | null> {
  const track = await getSoundCloud<SoundCloudTrack>(`/tracks/${trackId}`);
  if (
    track &&
    (track.streamable === false || track.access === "blocked" || track.access === "preview")
  ) {
    return null;
  }

  const userAccessToken = await getAccessToken();
  if (!userAccessToken) return null;

  const trackAuthorization = track?.track_authorization || fallbackTrackAuthorization;
  const trackTranscodings = track?.media?.transcodings
    ?.map(mapTranscoding)
    .filter((transcoding): transcoding is SoundCloudTranscoding => Boolean(transcoding));
  const progressiveUrls = uniqueUrls(
    (trackTranscodings?.length ? trackTranscodings : fallbackTranscodings || [])
      .filter(
        (transcoding) =>
          transcoding.url && !transcoding.snipped && transcoding.protocol === "progressive",
      )
      .map((transcoding) => transcoding.url),
  );

  for (const progressiveUrl of progressiveUrls) {
    const finalUrl = await resolvePlayableStreamUrl(
      progressiveUrl,
      userAccessToken,
      trackAuthorization,
    );
    if (finalUrl && !isPreviewStreamUrl(finalUrl) && !isHlsStreamUrl(finalUrl)) {
      return createSoundCloudAudioUrl(finalUrl);
    }
  }

  return null;
}

export async function getSoundCloudAnalysisAudioData(
  trackId: number,
  fallbackDurationSeconds: number,
  fallbackTranscodings?: SoundCloudTranscoding[],
  fallbackTrackAuthorization?: string,
): Promise<ArrayBuffer | null> {
  debugSoundCloud("BPM analysis requested", {
    trackId,
    fallbackDurationSeconds,
    fallbackTranscodings: fallbackTranscodings?.map((transcoding) => ({
      protocol: transcoding.protocol,
      mimeType: transcoding.mimeType,
      preset: transcoding.preset,
      snipped: transcoding.snipped,
    })),
  });
  const track = await getSoundCloud<SoundCloudTrack>(`/tracks/${trackId}`);
  const durationSeconds =
    track?.duration && track.duration > 0
      ? Math.round(track.duration / 1000)
      : fallbackDurationSeconds;
  if (!durationSeconds || durationSeconds > maxAnalysisDurationSeconds) {
    debugSoundCloud("BPM analysis skipped: duration outside limit", {
      trackId,
      durationSeconds,
      maxAnalysisDurationSeconds,
    });
    return null;
  }
  if (
    track &&
    (track.streamable === false || track.access === "blocked" || track.access === "preview")
  ) {
    debugSoundCloud("BPM analysis skipped: track unavailable", {
      trackId,
      streamable: track.streamable,
      access: track.access,
    });
    return null;
  }

  const userAccessToken = await getAccessToken();
  if (!userAccessToken) {
    debugSoundCloud("BPM analysis skipped: SoundCloud is not connected", { trackId });
    return null;
  }

  const trackAuthorization = track?.track_authorization || fallbackTrackAuthorization;
  const trackTranscodings = track?.media?.transcodings
    ?.map(mapTranscoding)
    .filter((transcoding): transcoding is SoundCloudTranscoding => Boolean(transcoding));
  const transcodings = orderSoundCloudTranscodings(
    trackTranscodings?.length ? trackTranscodings : fallbackTranscodings,
  ).filter(
    (transcoding): transcoding is SoundCloudTranscoding & { url: string } =>
      Boolean(transcoding.url) &&
      !transcoding.snipped &&
      (transcoding.protocol === "progressive" || transcoding.protocol === "hls"),
  );
  debugSoundCloud("BPM analysis candidate transcodings", {
    trackId,
    durationSeconds,
    count: transcodings.length,
    transcodings: transcodings.map((transcoding) => ({
      protocol: transcoding.protocol,
      mimeType: transcoding.mimeType,
      preset: transcoding.preset,
      quality: transcoding.quality,
    })),
  });
  const trackStreamApiUrls = uniqueUrls([track?.urn, String(trackId)]).map((trackResourceId) =>
    soundCloudTrackStreamsUrl(trackResourceId),
  );
  const candidateUrls = uniqueUrls([
    ...transcodings.map((transcoding) => transcoding.url),
    ...trackStreamApiUrls,
    track?.stream_url,
  ]);
  debugSoundCloud("BPM analysis candidate URLs", {
    trackId,
    count: candidateUrls.length,
    hasTranscodings: transcodings.length > 0,
    urls: candidateUrls,
  });

  for (const candidateUrl of candidateUrls) {
    debugSoundCloud("BPM analysis resolving candidate URL", {
      trackId,
      url: candidateUrl,
    });
    const finalUrl = await resolvePlayableStreamUrl(
      candidateUrl,
      userAccessToken,
      trackAuthorization,
    );
    debugSoundCloud("BPM analysis resolved candidate URL", {
      trackId,
      finalUrl,
      hls: finalUrl ? isHlsStreamUrl(finalUrl) : false,
      preview: finalUrl ? isPreviewStreamUrl(finalUrl) : false,
    });
    if (!finalUrl || isPreviewStreamUrl(finalUrl)) continue;

    const bytes = isHlsStreamUrl(finalUrl)
      ? await fetchSoundCloudHlsBytes(finalUrl, userAccessToken)
      : await fetchSoundCloudProgressiveBytes(finalUrl, userAccessToken);
    if (bytes) {
      debugSoundCloud("BPM analysis audio data ready", {
        trackId,
        protocol: isHlsStreamUrl(finalUrl) ? "hls" : "progressive",
        bytes: bytes.byteLength,
      });
      return bytes;
    }
  }

  debugSoundCloud("BPM analysis audio data unavailable", { trackId });
  return null;
}

export async function getSoundCloudWaveformPeaks(
  trackId: number,
  url?: string,
): Promise<number[][] | null> {
  const waveformSourceUrl =
    url || (await getSoundCloud<SoundCloudTrack>(`/tracks/${trackId}`))?.waveform_url;
  if (!waveformSourceUrl) return null;
  const waveformUrl = createSoundCloudWaveformJsonUrl(waveformSourceUrl);
  if (!waveformUrl) return null;

  try {
    const response = await soundCloudApiFetch(waveformUrl, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    return mapSoundCloudWaveformPeaks((await response.json()) as SoundCloudWaveformResponse);
  } catch {
    return null;
  }
}

async function handleSoundCloudImageRequest(request: Request): Promise<Response> {
  try {
    const sourceUrl = decodeImageUrl(request.url);
    const response = await soundCloudAssetFetch(sourceUrl);
    if (!response.ok || !response.body) {
      return new Response(null, { status: response.status || 404 });
    }

    return new Response(response.body, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=86400",
        "Content-Type": response.headers.get("content-type") || "image/jpeg",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}

async function handleSoundCloudAudioRequest(request: Request): Promise<Response> {
  try {
    const sourceUrl = decodeImageUrl(request.url);
    const headers = new Headers();
    const range = request.headers.get("range");
    if (range) headers.set("Range", range);
    if (isSoundCloudApiUrl(sourceUrl)) {
      const accessToken = await getAccessToken();
      if (!accessToken) return new Response(null, { status: 401 });
      headers.set("Authorization", `OAuth ${accessToken}`);
    }

    const response = await soundCloudAssetFetch(sourceUrl, { headers });
    if (!response.ok || !response.body) {
      return new Response(null, { status: response.status || 404 });
    }

    const responseHeaders = new Headers({
      "Access-Control-Allow-Origin": "*",
      "Accept-Ranges": response.headers.get("accept-ranges") || "bytes",
      "Content-Type": response.headers.get("content-type") || "audio/mpeg",
    });
    for (const header of ["content-length", "content-range"]) {
      const value = response.headers.get(header);
      if (value) responseHeaders.set(header, value);
    }

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}

export function registerSoundCloudIpc(): void {
  if (protocol.isProtocolHandled("playhead-soundcloud-image")) {
    protocol.unhandle("playhead-soundcloud-image");
  }
  protocol.handle("playhead-soundcloud-image", handleSoundCloudImageRequest);
  if (protocol.isProtocolHandled("playhead-soundcloud-audio")) {
    protocol.unhandle("playhead-soundcloud-audio");
  }
  protocol.handle("playhead-soundcloud-audio", handleSoundCloudAudioRequest);

  ipcMain.handle("soundcloud:get-state", () => getSoundCloudState());
  ipcMain.handle("soundcloud:start-auth", () => startSoundCloudAuth());
  ipcMain.handle("soundcloud:complete-auth", (_event, code: string, state?: string) =>
    completeSoundCloudAuth(code, state),
  );
  ipcMain.handle("soundcloud:disconnect", () => disconnectSoundCloud());
  ipcMain.handle("soundcloud:get-collections", (_event, visible: SoundCloudCollectionId[]) =>
    getSoundCloudCollections(visible),
  );
  ipcMain.handle("soundcloud:get-collection-tracks", (_event, collectionId: string) =>
    getSoundCloudCollectionTracks(collectionId),
  );
  ipcMain.handle(
    "soundcloud:get-stream-url",
    (
      _event,
      trackId: number,
      streamUrl?: string,
      transcodings?: SoundCloudTranscoding[],
      trackAuthorization?: string,
    ) => getSoundCloudStreamUrl(trackId, streamUrl, transcodings, trackAuthorization),
  );
  ipcMain.handle(
    "soundcloud:get-progressive-stream-url",
    (
      _event,
      trackId: number,
      transcodings?: SoundCloudTranscoding[],
      trackAuthorization?: string,
    ) => getSoundCloudProgressiveStreamUrl(trackId, transcodings, trackAuthorization),
  );
  ipcMain.handle(
    "soundcloud:get-analysis-audio-data",
    (
      _event,
      trackId: number,
      durationSeconds: number,
      transcodings?: SoundCloudTranscoding[],
      trackAuthorization?: string,
    ) =>
      getSoundCloudAnalysisAudioData(trackId, durationSeconds, transcodings, trackAuthorization),
  );
  ipcMain.handle("soundcloud:get-image-url", (_event, url: string) =>
    createSoundCloudImageUrl(url),
  );
  ipcMain.handle("soundcloud:get-waveform-peaks", (_event, trackId: number, url?: string) =>
    getSoundCloudWaveformPeaks(trackId, url),
  );
}
