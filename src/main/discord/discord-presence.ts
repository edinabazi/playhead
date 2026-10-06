import { Client } from "@xhayper/discord-rpc";
import type { DiscordPresence } from "../../shared/library";
import { electron } from "../electron";

const { ipcMain } = electron;

// The application id is public (Discord shows it to every user), so builds can embed it.
const clientId = process.env.DISCORD_CLIENT_ID || "";
// Discord's "Listening to" activity type.
const listeningActivityType = 2;
// After a failed connection (Discord closed or not installed) wait before trying again.
const reconnectDelayMs = 30_000;

let client: Client | null = null;
let connecting: Promise<Client | null> | null = null;
let lastFailureAt = 0;
let enabled = false;

export function isDiscordConfigured() {
  return Boolean(clientId);
}

async function connect(): Promise<Client | null> {
  if (client?.isConnected) return client;
  if (Date.now() - lastFailureAt < reconnectDelayMs) return null;
  connecting ??= (async () => {
    const next = new Client({ clientId });
    next.on("disconnected", () => {
      if (client === next) client = null;
    });
    try {
      await next.login();
      client = next;
      return next;
    } catch {
      lastFailureAt = Date.now();
      await next.destroy().catch(() => undefined);
      return null;
    } finally {
      connecting = null;
    }
  })();
  return connecting;
}

async function disconnect() {
  const current = client;
  client = null;
  await current?.user?.clearActivity().catch(() => undefined);
  await current?.destroy().catch(() => undefined);
}

// Discord rejects text fields outside 2–128 characters.
function field(value: string | undefined) {
  const text = (value || "").trim();
  if (!text) return undefined;
  return text.length < 2 ? `${text} ` : text.slice(0, 128);
}

export async function updateDiscordPresence(presence: DiscordPresence | null): Promise<void> {
  if (!enabled || !isDiscordConfigured()) return;
  const connected = await connect();
  if (!connected?.user) return;
  if (!presence) {
    await connected.user.clearActivity().catch(() => undefined);
    return;
  }
  const start = Date.now() - presence.positionSeconds * 1000;
  await connected.user
    .setActivity({
      type: listeningActivityType,
      details: field(presence.title),
      state: field(presence.artist),
      largeImageText: field(presence.album),
      ...(presence.artworkUrl
        ? { largeImageUrl: presence.artworkUrl }
        : { largeImageKey: "playhead" }),
      ...(presence.durationSeconds > 0
        ? {
            startTimestamp: start,
            endTimestamp: start + presence.durationSeconds * 1000,
          }
        : {}),
    })
    .catch(() => undefined);
}

export function registerDiscordIpc() {
  ipcMain.handle("discord:is-configured", () => isDiscordConfigured());
  ipcMain.handle("discord:set-enabled", async (_event, next: boolean) => {
    enabled = next;
    lastFailureAt = 0;
    if (!next) await disconnect();
  });
  ipcMain.handle("discord:update", (_event, presence: DiscordPresence | null) =>
    updateDiscordPresence(presence),
  );
}
