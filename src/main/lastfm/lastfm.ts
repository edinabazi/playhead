import { createHash } from "node:crypto";
import { readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import type { LastfmState, LastfmTrackPayload } from "../../shared/library";
import { electron } from "../electron";
import { hasIntegrationsBroker, postIntegrationsBroker } from "../integrations-broker";

const { app, ipcMain, safeStorage, shell } = electron;

const apiRoot = "https://ws.audioscrobbler.com/2.0/";
const authRoot = "https://www.last.fm/api/auth/";
const apiKey = process.env.LASTFM_API_KEY || "";
const sharedSecret = process.env.LASTFM_SHARED_SECRET || "";

type LastfmSession = {
  username: string;
  sessionKey: string;
  encrypted: boolean;
};

type LastfmStoredState = {
  pendingToken?: string;
  session?: LastfmSession;
  lastError?: string;
};

export type LastfmQueueJob =
  | { id: string; type: "scrobble"; track: LastfmTrackPayload }
  | { id: string; type: "love" | "unlove"; track: LastfmTrackPayload };

type LastfmApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; retryable: boolean };

function statePath(): string {
  return join(app.getPath("userData"), "lastfm.json");
}

function queuePath(): string {
  return join(app.getPath("userData"), "lastfm-queue.json");
}

function isConfigured(): boolean {
  return hasIntegrationsBroker() || Boolean(apiKey && sharedSecret);
}

function normalizeTrack(track: LastfmTrackPayload): LastfmTrackPayload | null {
  const artist = track.artist.trim();
  const title = track.title.trim();
  if (!artist || !title) return null;

  return {
    artist,
    title,
    album: track.album?.trim() || undefined,
    albumArtist: track.albumArtist?.trim() || undefined,
    duration: track.duration && track.duration > 0 ? Math.round(track.duration) : undefined,
    timestamp: track.timestamp && track.timestamp > 0 ? Math.floor(track.timestamp) : undefined,
  };
}

export function signLastfmParams(params: Record<string, string | number | undefined>): string {
  const payload = Object.entries(params)
    .filter(([, value]) => value !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}${String(value)}`)
    .join("");

  return createHash("md5").update(`${payload}${sharedSecret}`).digest("hex");
}

export function createLastfmAuthUrl(token: string): string {
  const params = new URLSearchParams({ api_key: apiKey, token });
  return `${authRoot}?${params.toString()}`;
}

export function collapseLastfmLoveQueue(
  queue: LastfmQueueJob[],
  job: Omit<LastfmQueueJob, "id">,
): LastfmQueueJob[] {
  const normalized = normalizeTrack(job.track);
  if (!normalized || (job.type !== "love" && job.type !== "unlove")) return queue;
  return queue.filter(
    (item) =>
      item.type === "scrobble" ||
      item.track.artist !== normalized.artist ||
      item.track.title !== normalized.title,
  );
}

function createForm(params: Record<string, string | number | undefined>): URLSearchParams {
  const form = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) form.set(key, String(value));
  }
  form.set("format", "json");
  form.set("api_sig", signLastfmParams(params));
  return form;
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

function encryptSessionKey(sessionKey: string): string {
  if (!safeStorage?.isEncryptionAvailable()) return sessionKey;
  return safeStorage.encryptString(sessionKey).toString("base64");
}

function decryptSessionKey(session: LastfmSession): string {
  if (!session.encrypted) return session.sessionKey;
  return safeStorage.decryptString(Buffer.from(session.sessionKey, "base64"));
}

async function readStoredState(): Promise<LastfmStoredState> {
  return readJson<LastfmStoredState>(statePath(), {});
}

async function writeStoredState(state: LastfmStoredState): Promise<void> {
  await writeJson(statePath(), state);
}

async function readQueue(): Promise<LastfmQueueJob[]> {
  const queue = await readJson<LastfmQueueJob[]>(queuePath(), []);
  return Array.isArray(queue) ? queue : [];
}

async function writeQueue(queue: LastfmQueueJob[]): Promise<void> {
  await writeJson(queuePath(), queue);
}

async function getSessionKey(): Promise<string | null> {
  const state = await readStoredState();
  if (!state.session) return null;
  try {
    return decryptSessionKey(state.session);
  } catch {
    await writeStoredState({ ...state, session: undefined, lastError: "Last.fm session expired." });
    return null;
  }
}

async function setLastError(message?: string): Promise<void> {
  const state = await readStoredState();
  await writeStoredState({ ...state, lastError: message });
}

export async function getLastfmState(): Promise<LastfmState> {
  const [state, queue] = await Promise.all([readStoredState(), readQueue()]);
  return {
    configured: isConfigured(),
    connected: Boolean(state.session),
    username: state.session?.username,
    pendingAuth: Boolean(state.pendingToken),
    queueSize: queue.length,
    lastError: state.lastError,
  };
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

async function postLastfm<T>(
  params: Record<string, string | number | undefined>,
): Promise<LastfmApiResponse<T>> {
  if (hasIntegrationsBroker()) {
    try {
      return await postIntegrationsBroker<LastfmApiResponse<T>>("/lastfm/request", { params });
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Last.fm broker request failed.",
        retryable: true,
      };
    }
  }

  if (!isConfigured()) {
    return { ok: false, error: "Last.fm credentials are not configured.", retryable: false };
  }

  try {
    const response = await fetch(apiRoot, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: createForm(params),
    });
    const data = (await response.json().catch(() => null)) as T & {
      error?: number;
      message?: string;
    };
    if (!response.ok || data?.error) {
      return {
        ok: false,
        error: data?.message || `Last.fm request failed (${response.status}).`,
        retryable: isRetryableStatus(response.status) || data?.error === 16 || data?.error === 29,
      };
    }

    return { ok: true, data };
  } catch {
    return { ok: false, error: "Last.fm is unreachable.", retryable: true };
  }
}

async function enqueue(job: Omit<LastfmQueueJob, "id">): Promise<void> {
  const queue = await readQueue();
  const normalized = normalizeTrack(job.track);
  if (!normalized) return;
  const nextJob = { ...job, track: normalized, id: `${Date.now()}-${Math.random()}` };
  const nextQueue =
    job.type === "love" || job.type === "unlove"
      ? collapseLastfmLoveQueue(queue, job)
      : queue;
  nextQueue.push(nextJob);
  await writeQueue(nextQueue);
}

async function runQueueJob(job: LastfmQueueJob, sessionKey: string): Promise<LastfmApiResponse<unknown>> {
  if (job.type === "scrobble") return sendScrobble(job.track, sessionKey);
  if (job.type === "love") return sendLove(job.track, sessionKey, true);
  return sendLove(job.track, sessionKey, false);
}

async function flushQueueInternal(): Promise<void> {
  const sessionKey = await getSessionKey();
  if (!sessionKey) return;

  const queue = await readQueue();
  const remaining: LastfmQueueJob[] = [];
  for (let index = 0; index < queue.length; index += 1) {
    const job = queue[index];
    const result = await runQueueJob(job, sessionKey);
    if (result.ok) continue;
    await setLastError(result.error);
    if (result.retryable) {
      remaining.push(...queue.slice(index));
      break;
    }
  }
  await writeQueue(remaining);
}

async function sendNowPlaying(track: LastfmTrackPayload, sessionKey: string): Promise<LastfmApiResponse<unknown>> {
  const normalized = normalizeTrack(track);
  if (!normalized) return { ok: false, error: "Track metadata is missing.", retryable: false };
  return postLastfm({
    method: "track.updateNowPlaying",
    api_key: apiKey,
    sk: sessionKey,
    artist: normalized.artist,
    track: normalized.title,
    album: normalized.album,
    albumArtist: normalized.albumArtist,
    duration: normalized.duration,
  });
}

async function sendScrobble(track: LastfmTrackPayload, sessionKey: string): Promise<LastfmApiResponse<unknown>> {
  const normalized = normalizeTrack(track);
  if (!normalized || !normalized.timestamp) {
    return { ok: false, error: "Track metadata is missing.", retryable: false };
  }
  return postLastfm({
    method: "track.scrobble",
    api_key: apiKey,
    sk: sessionKey,
    artist: normalized.artist,
    track: normalized.title,
    album: normalized.album,
    albumArtist: normalized.albumArtist,
    duration: normalized.duration,
    timestamp: normalized.timestamp,
  });
}

async function sendLove(
  track: LastfmTrackPayload,
  sessionKey: string,
  loved: boolean,
): Promise<LastfmApiResponse<unknown>> {
  const normalized = normalizeTrack(track);
  if (!normalized) return { ok: false, error: "Track metadata is missing.", retryable: false };
  return postLastfm({
    method: loved ? "track.love" : "track.unlove",
    api_key: apiKey,
    sk: sessionKey,
    artist: normalized.artist,
    track: normalized.title,
  });
}

export async function startLastfmAuth(): Promise<LastfmState> {
  if (!isConfigured()) return getLastfmState();

  if (hasIntegrationsBroker()) {
    try {
      const response = await postIntegrationsBroker<{ token: string; authUrl: string }>(
        "/lastfm/auth-token",
        {},
      );
      const state = await readStoredState();
      await writeStoredState({ ...state, pendingToken: response.token, lastError: undefined });
      await shell.openExternal(response.authUrl);
    } catch (error) {
      await setLastError(error instanceof Error ? error.message : "Last.fm auth failed.");
    }
    return getLastfmState();
  }

  const response = await postLastfm<{ token: string }>({ method: "auth.getToken", api_key: apiKey });
  if (!response.ok) {
    await setLastError(response.error);
    return getLastfmState();
  }

  const state = await readStoredState();
  await writeStoredState({ ...state, pendingToken: response.data.token, lastError: undefined });
  await shell.openExternal(createLastfmAuthUrl(response.data.token));
  return getLastfmState();
}

export async function completeLastfmAuth(): Promise<LastfmState> {
  const state = await readStoredState();
  if (!state.pendingToken) return getLastfmState();

  if (hasIntegrationsBroker()) {
    try {
      const response = await postIntegrationsBroker<{ username: string; sessionKey: string }>(
        "/lastfm/session",
        { token: state.pendingToken },
      );
      await writeStoredState({
        session: {
          username: response.username,
          sessionKey: encryptSessionKey(response.sessionKey),
          encrypted: Boolean(safeStorage?.isEncryptionAvailable()),
        },
      });
      void flushQueueInternal();
    } catch (error) {
      await setLastError(error instanceof Error ? error.message : "Last.fm auth failed.");
    }
    return getLastfmState();
  }

  const response = await postLastfm<{ session: { name: string; key: string } }>({
    method: "auth.getSession",
    api_key: apiKey,
    token: state.pendingToken,
  });
  if (!response.ok) {
    await setLastError(response.error);
    return getLastfmState();
  }

  await writeStoredState({
    session: {
      username: response.data.session.name,
      sessionKey: encryptSessionKey(response.data.session.key),
      encrypted: Boolean(safeStorage?.isEncryptionAvailable()),
    },
  });
  void flushQueueInternal();
  return getLastfmState();
}

export async function disconnectLastfm(): Promise<LastfmState> {
  await rm(statePath(), { force: true });
  await rm(queuePath(), { force: true });
  return getLastfmState();
}

async function withSession(
  action: (sessionKey: string) => Promise<LastfmApiResponse<unknown>>,
): Promise<LastfmState> {
  await flushQueueInternal();
  const sessionKey = await getSessionKey();
  if (!sessionKey) return getLastfmState();

  const result = await action(sessionKey);
  if (!result.ok) await setLastError(result.error);
  else await setLastError(undefined);
  return getLastfmState();
}

export async function updateLastfmNowPlaying(track: LastfmTrackPayload): Promise<LastfmState> {
  return withSession((sessionKey) => sendNowPlaying(track, sessionKey));
}

export async function scrobbleLastfmTrack(track: LastfmTrackPayload): Promise<LastfmState> {
  const sessionKey = await getSessionKey();
  if (!sessionKey) return getLastfmState();
  const result = await sendScrobble(track, sessionKey);
  if (!result.ok && result.retryable) await enqueue({ type: "scrobble", track });
  await setLastError(result.ok ? undefined : result.error);
  return getLastfmState();
}

export async function loveLastfmTrack(track: LastfmTrackPayload): Promise<LastfmState> {
  const sessionKey = await getSessionKey();
  if (!sessionKey) return getLastfmState();
  const result = await sendLove(track, sessionKey, true);
  if (!result.ok && result.retryable) await enqueue({ type: "love", track });
  await setLastError(result.ok ? undefined : result.error);
  return getLastfmState();
}

export async function unloveLastfmTrack(track: LastfmTrackPayload): Promise<LastfmState> {
  const sessionKey = await getSessionKey();
  if (!sessionKey) return getLastfmState();
  const result = await sendLove(track, sessionKey, false);
  if (!result.ok && result.retryable) await enqueue({ type: "unlove", track });
  await setLastError(result.ok ? undefined : result.error);
  return getLastfmState();
}

export async function flushLastfmQueue(): Promise<LastfmState> {
  await flushQueueInternal();
  return getLastfmState();
}

export function registerLastfmIpc(): void {
  ipcMain.handle("lastfm:get-state", () => getLastfmState());
  ipcMain.handle("lastfm:start-auth", () => startLastfmAuth());
  ipcMain.handle("lastfm:complete-auth", () => completeLastfmAuth());
  ipcMain.handle("lastfm:disconnect", () => disconnectLastfm());
  ipcMain.handle("lastfm:update-now-playing", (_event, track: LastfmTrackPayload) =>
    updateLastfmNowPlaying(track),
  );
  ipcMain.handle("lastfm:scrobble", (_event, track: LastfmTrackPayload) =>
    scrobbleLastfmTrack(track),
  );
  ipcMain.handle("lastfm:love", (_event, track: LastfmTrackPayload) => loveLastfmTrack(track));
  ipcMain.handle("lastfm:unlove", (_event, track: LastfmTrackPayload) => unloveLastfmTrack(track));
  ipcMain.handle("lastfm:flush-queue", () => flushLastfmQueue());
}
