import { md5 } from "@noble/hashes/legacy.js";

const lastfmApiRoot = "https://ws.audioscrobbler.com/2.0/";
const lastfmAuthRoot = "https://www.last.fm/api/auth/";
const soundcloudAuthRoot = "https://secure.soundcloud.com/authorize";
const soundcloudTokenRoot = "https://secure.soundcloud.com/oauth/token";
const defaultSoundCloudRedirectUri = "playhead://soundcloud/callback";
const maxJsonBytes = 16 * 1024;

type BrokerEnv = Env & {
  LASTFM_API_KEY?: string;
  LASTFM_SHARED_SECRET?: string;
  SOUNDCLOUD_CLIENT_ID?: string;
  SOUNDCLOUD_CLIENT_SECRET?: string;
  SOUNDCLOUD_REDIRECT_URI?: string;
};

type LastfmApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; retryable: boolean };

type LastfmPayload = Record<string, string | number | undefined>;

type LastfmErrorPayload = {
  error?: number;
  message?: string;
};

type LastfmTokenPayload = {
  token?: string;
};

type LastfmSessionPayload = {
  session?: {
    name?: string;
    key?: string;
  };
};

type SoundCloudTokenPayload = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

const allowedLastfmMethods = new Set([
  "track.updateNowPlaying",
  "track.scrobble",
  "track.love",
  "track.unlove",
]);

const allowedLastfmParamKeys = new Set([
  "method",
  "sk",
  "artist",
  "track",
  "album",
  "albumArtist",
  "duration",
  "timestamp",
]);

export default {
  async fetch(request: Request, env: BrokerEnv): Promise<Response> {
    try {
      if (request.method === "OPTIONS") return new Response(null, { status: 204 });
      const url = new URL(request.url);

      if (request.method === "GET" && url.pathname === "/health") {
        return jsonResponse({ ok: true });
      }

      if (request.method !== "POST") {
        return jsonResponse({ error: "Method not allowed." }, 405);
      }

      if (url.pathname === "/lastfm/auth-token") return handleLastfmAuthToken(env);
      if (url.pathname === "/lastfm/session") return handleLastfmSession(request, env);
      if (url.pathname === "/lastfm/request") return handleLastfmRequest(request, env);
      if (url.pathname === "/soundcloud/auth-url") return handleSoundCloudAuthUrl(request, env);
      if (url.pathname === "/soundcloud/token") return handleSoundCloudToken(request, env);

      return jsonResponse({ error: "Not found." }, 404);
    } catch (error) {
      return jsonResponse(
        { error: error instanceof Error ? error.message : "Unexpected broker error." },
        500,
      );
    }
  },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

async function readJsonBody<T>(request: Request): Promise<T> {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > maxJsonBytes) throw new Error("Request body is too large.");
  return (await request.json()) as T;
}

function requireValue(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function isRetryableLastfmStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function signLastfmParams(params: LastfmPayload, sharedSecret: string): string {
  const payload = Object.entries(params)
    .filter(([, value]) => value !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}${String(value)}`)
    .join("");

  return toHex(md5(new TextEncoder().encode(`${payload}${sharedSecret}`)));
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function createLastfmForm(params: LastfmPayload, sharedSecret: string): URLSearchParams {
  const form = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) form.set(key, String(value));
  }
  form.set("format", "json");
  form.set("api_sig", signLastfmParams(params, sharedSecret));
  return form;
}

async function postLastfm<T>(
  env: BrokerEnv,
  params: LastfmPayload,
): Promise<LastfmApiResponse<T>> {
  const apiKey = requireValue(env.LASTFM_API_KEY, "LASTFM_API_KEY");
  const sharedSecret = requireValue(env.LASTFM_SHARED_SECRET, "LASTFM_SHARED_SECRET");

  try {
    const response = await fetch(lastfmApiRoot, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: createLastfmForm({ ...params, api_key: apiKey }, sharedSecret),
    });
    const data = (await response.json().catch(() => null)) as
      | (T & LastfmErrorPayload)
      | null;
    if (!response.ok || data?.error) {
      return {
        ok: false,
        error: data?.message || `Last.fm request failed (${response.status}).`,
        retryable:
          isRetryableLastfmStatus(response.status) || data?.error === 16 || data?.error === 29,
      };
    }

    return { ok: true, data: data as T };
  } catch {
    return { ok: false, error: "Last.fm is unreachable.", retryable: true };
  }
}

async function handleLastfmAuthToken(env: BrokerEnv): Promise<Response> {
  const apiKey = requireValue(env.LASTFM_API_KEY, "LASTFM_API_KEY");
  const response = await postLastfm<LastfmTokenPayload>(env, { method: "auth.getToken" });
  if (!response.ok || !response.data.token) {
    return jsonResponse({ error: response.ok ? "Last.fm auth failed." : response.error }, 502);
  }

  const params = new URLSearchParams({ api_key: apiKey, token: response.data.token });
  return jsonResponse({
    token: response.data.token,
    authUrl: `${lastfmAuthRoot}?${params.toString()}`,
  });
}

async function handleLastfmSession(request: Request, env: BrokerEnv): Promise<Response> {
  const body = await readJsonBody<{ token?: string }>(request);
  if (!body.token) return jsonResponse({ error: "Last.fm token is required." }, 400);

  const response = await postLastfm<LastfmSessionPayload>(env, {
    method: "auth.getSession",
    token: body.token,
  });
  const session = response.ok ? response.data.session : undefined;
  if (!response.ok || !session?.name || !session.key) {
    return jsonResponse({ error: response.ok ? "Last.fm auth failed." : response.error }, 502);
  }

  return jsonResponse({ username: session.name, sessionKey: session.key });
}

async function handleLastfmRequest(request: Request, env: BrokerEnv): Promise<Response> {
  const body = await readJsonBody<{ params?: Record<string, unknown> }>(request);
  const params = normalizeLastfmParams(body.params);
  if (!params.method || !allowedLastfmMethods.has(String(params.method))) {
    return jsonResponse({ error: "Unsupported Last.fm method." }, 400);
  }
  if (!params.sk) return jsonResponse({ error: "Last.fm session key is required." }, 400);
  if (!params.artist || !params.track) {
    return jsonResponse({ error: "Last.fm track metadata is required." }, 400);
  }

  const response = await postLastfm<unknown>(env, params);
  return jsonResponse(response);
}

function normalizeLastfmParams(params: Record<string, unknown> | undefined): LastfmPayload {
  const normalized: LastfmPayload = {};
  if (!params) return normalized;

  for (const [key, value] of Object.entries(params)) {
    if (!allowedLastfmParamKeys.has(key)) continue;
    if (typeof value === "string") normalized[key] = value;
    else if (typeof value === "number" && Number.isFinite(value)) normalized[key] = value;
  }

  return normalized;
}

async function handleSoundCloudAuthUrl(request: Request, env: BrokerEnv): Promise<Response> {
  const body = await readJsonBody<{ state?: string; codeChallenge?: string }>(request);
  if (!body.state || !body.codeChallenge) {
    return jsonResponse({ error: "SoundCloud state and code challenge are required." }, 400);
  }

  const params = new URLSearchParams({
    client_id: requireValue(env.SOUNDCLOUD_CLIENT_ID, "SOUNDCLOUD_CLIENT_ID"),
    redirect_uri: env.SOUNDCLOUD_REDIRECT_URI || defaultSoundCloudRedirectUri,
    response_type: "code",
    state: body.state,
    code_challenge: body.codeChallenge,
    code_challenge_method: "S256",
  });
  return jsonResponse({ authUrl: `${soundcloudAuthRoot}?${params.toString()}` });
}

async function handleSoundCloudToken(request: Request, env: BrokerEnv): Promise<Response> {
  const body = await readJsonBody<{
    grantType?: string;
    code?: string;
    codeVerifier?: string;
    refreshToken?: string;
  }>(request);

  const grantType = body.grantType;
  if (grantType !== "authorization_code" && grantType !== "refresh_token") {
    return jsonResponse({ error: "Unsupported SoundCloud grant type." }, 400);
  }

  const tokenParams = new URLSearchParams({
    client_id: requireValue(env.SOUNDCLOUD_CLIENT_ID, "SOUNDCLOUD_CLIENT_ID"),
    client_secret: requireValue(env.SOUNDCLOUD_CLIENT_SECRET, "SOUNDCLOUD_CLIENT_SECRET"),
    redirect_uri: env.SOUNDCLOUD_REDIRECT_URI || defaultSoundCloudRedirectUri,
    grant_type: grantType,
  });

  if (grantType === "authorization_code") {
    if (!body.code || !body.codeVerifier) {
      return jsonResponse({ error: "SoundCloud code and verifier are required." }, 400);
    }
    tokenParams.set("code", body.code);
    tokenParams.set("code_verifier", body.codeVerifier);
  } else {
    if (!body.refreshToken) {
      return jsonResponse({ error: "SoundCloud refresh token is required." }, 400);
    }
    tokenParams.set("refresh_token", body.refreshToken);
  }

  const response = await fetch(soundcloudTokenRoot, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenParams,
  });
  const data = (await response.json().catch(() => null)) as SoundCloudTokenPayload | null;
  if (!response.ok || !data?.access_token) {
    return jsonResponse(
      { error: data?.error_description || data?.error || "SoundCloud auth failed." },
      502,
    );
  }

  return jsonResponse({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
  });
}
