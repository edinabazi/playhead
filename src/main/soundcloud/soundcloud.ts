import { createHash, randomBytes } from "node:crypto";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  LibraryTrack,
  SoundCloudCollection,
  SoundCloudCollectionId,
  SoundCloudState,
} from "../../shared/library";
import { electron } from "../electron";

const { app, ipcMain, safeStorage, shell } = electron;

const apiRoot = "https://api.soundcloud.com";
const authRoot = "https://secure.soundcloud.com/authorize";
const tokenRoot = "https://secure.soundcloud.com/oauth/token";
const clientId = process.env.SOUNDCLOUD_CLIENT_ID || "";
const clientSecret = process.env.SOUNDCLOUD_CLIENT_SECRET || "";
const redirectUri = process.env.SOUNDCLOUD_REDIRECT_URI || "playhead://soundcloud/callback";

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

type SoundCloudTrack = {
  id: number;
  title: string;
  duration?: number;
  streamable?: boolean;
  access?: "playable" | "preview" | "blocked";
  artwork_url?: string;
  permalink_url?: string;
  user?: { username?: string };
};

type SoundCloudPlaylist = {
  id: number;
  title: string;
  track_count?: number;
  tracks?: SoundCloudTrack[];
  user?: { username?: string };
};

type Paginated<T> = {
  collection?: T[];
  next_href?: string | null;
};

function statePath(): string {
  return join(app.getPath("userData"), "soundcloud.json");
}

function isConfigured(): boolean {
  return Boolean(clientId && clientSecret);
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
  const response = await fetch(tokenRoot, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      ...params,
    }),
  });
  const data = (await response.json().catch(() => null)) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  } | null;

  if (!response.ok || !data?.access_token) {
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
    await writeStoredState({ ...state, session: undefined, lastError: "SoundCloud session expired." });
    return null;
  }
}

async function getSoundCloud<T>(pathOrUrl: string): Promise<T | null> {
  const accessToken = await getAccessToken();
  if (!accessToken) return null;
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${apiRoot}${pathOrUrl}`;
  const response = await fetch(url, {
    headers: { Authorization: `OAuth ${accessToken}` },
  });
  if (!response.ok) {
    await setLastError(`SoundCloud request failed (${response.status}).`);
    return null;
  }
  await setLastError(undefined);
  return (await response.json()) as T;
}

async function getAllPages<T>(path: string): Promise<T[]> {
  let nextUrl: string | null = `${apiRoot}${path}${path.includes("?") ? "&" : "?"}linked_partitioning=1&limit=50`;
  const items: T[] = [];
  while (nextUrl) {
    const page = await getSoundCloud<Paginated<T>>(nextUrl);
    if (!page) break;
    items.push(...(page.collection || []));
    nextUrl = page.next_href || null;
  }
  return items;
}

function mapTrack(track: SoundCloudTrack): LibraryTrack {
  return {
    id: `soundcloud:${track.id}`,
    source: "soundcloud",
    path: `soundcloud:${track.id}`,
    fileName: `${track.id}`,
    title: track.title || "Untitled",
    artist: track.user?.username || "SoundCloud",
    duration: Math.max(0, Math.round((track.duration || 0) / 1000)),
    folderId: "soundcloud",
    artwork: track.artwork_url ? { mimeType: "image/jpeg", src: track.artwork_url } : undefined,
    audioFormat: "SoundCloud",
    soundcloud: {
      id: track.id,
      permalinkUrl: track.permalink_url,
      streamable: Boolean(track.streamable),
      access: track.access,
      artworkUrl: track.artwork_url,
      username: track.user?.username,
    },
  };
}

export async function startSoundCloudAuth(): Promise<SoundCloudState> {
  if (!isConfigured()) return getSoundCloudState();
  const state = await readStoredState();
  const pendingState = randomBytes(18).toString("base64url");
  const pendingCodeVerifier = randomBytes(48).toString("base64url");
  await writeStoredState({ ...state, pendingState, pendingCodeVerifier, lastError: undefined });
  await shell.openExternal(createAuthUrl(pendingState, pendingCodeVerifier));
  return getSoundCloudState();
}

export async function completeSoundCloudAuth(code: string, returnedState?: string): Promise<SoundCloudState> {
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
  const meResponse = await fetch(`${apiRoot}/me`, {
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
        id: `playlist:${playlist.id}` as const,
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
    const playlistId = collectionId.slice("playlist:".length);
    const playlist = await getSoundCloud<SoundCloudPlaylist>(`/playlists/${playlistId}`);
    return (playlist?.tracks || []).map(mapTrack);
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
    return playlists.flatMap((playlist) => playlist.tracks || []).map(mapTrack);
  }
  if (collectionId === "reposted-playlists") {
    const playlists = await getAllPages<SoundCloudPlaylist>("/me/reposts/playlists");
    return playlists.flatMap((playlist) => playlist.tracks || []).map(mapTrack);
  }

  return [];
}

export async function getSoundCloudStreamUrl(trackId: number): Promise<string> {
  const track = await getSoundCloud<SoundCloudTrack>(`/tracks/${trackId}`);
  if (!track?.streamable || track.access !== "playable") {
    throw new Error("This SoundCloud track is not available for full playback.");
  }
  const accessToken = await getAccessToken();
  if (!accessToken) throw new Error("SoundCloud is not connected.");
  const response = await fetch(`${apiRoot}/tracks/${trackId}/streams`, {
    headers: { Authorization: `OAuth ${accessToken}` },
  });
  const streams = (await response.json().catch(() => null)) as Record<string, string> | null;
  const url = streams?.http_mp3_128_url || streams?.hls_mp3_128_url;
  if (!response.ok || !url) throw new Error("SoundCloud stream is unavailable.");
  return url;
}

export function registerSoundCloudIpc(): void {
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
  ipcMain.handle("soundcloud:get-stream-url", (_event, trackId: number) =>
    getSoundCloudStreamUrl(trackId),
  );
}
