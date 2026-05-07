import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import electron from "electron";
import { readLibraryState } from "./library/store";

const { app, ipcMain } = electron;

type TelemetryPayload = {
  api_key: string;
  event: string;
  distinct_id: string;
  timestamp: string;
  properties: Record<string, string | number | boolean>;
};

type TelemetryState = {
  anonymousId: string;
  installedTracked?: boolean;
};

const posthogApiKey = process.env.POSTHOG_PROJECT_API_KEY || "";
const posthogHost = process.env.POSTHOG_HOST || "https://eu.i.posthog.com";
const allowedEventName = /^[a-z][a-z0-9_]{1,63}$/;

function telemetryStatePath(): string {
  return join(app.getPath("userData"), "telemetry.json");
}

async function readTelemetryState(): Promise<TelemetryState> {
  try {
    const raw = await readFile(telemetryStatePath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<TelemetryState>;
    if (parsed.anonymousId) {
      return {
        anonymousId: parsed.anonymousId,
        installedTracked: Boolean(parsed.installedTracked),
      };
    }
  } catch {
    // Missing or invalid telemetry state is replaced below.
  }

  return { anonymousId: randomUUID() };
}

async function writeTelemetryState(state: TelemetryState): Promise<void> {
  await writeFile(telemetryStatePath(), `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

async function canSendTelemetry(): Promise<boolean> {
  if (!posthogApiKey) return false;
  const state = await readLibraryState();
  return state.settings.telemetry.enabled;
}

function sanitizeProperties(
  properties: Record<string, string | number | boolean> = {},
): Record<string, string | number | boolean> {
  return Object.fromEntries(
    Object.entries(properties)
      .filter(([, value]) => ["string", "number", "boolean"].includes(typeof value))
      .map(([key, value]) => [
        key.slice(0, 64),
        typeof value === "string" ? value.slice(0, 120) : value,
      ]),
  );
}

export async function trackTelemetryEvent(
  event: string,
  properties: Record<string, string | number | boolean> = {},
): Promise<boolean> {
  if (!allowedEventName.test(event)) return false;
  if (!(await canSendTelemetry())) return false;

  const state = await readTelemetryState();
  const payload: TelemetryPayload = {
    api_key: posthogApiKey,
    event,
    distinct_id: state.anonymousId,
    timestamp: new Date().toISOString(),
    properties: {
      ...sanitizeProperties(properties),
      app_version: app.getVersion(),
      platform: process.platform,
    },
  };

  try {
    const response = await fetch(`${posthogHost.replace(/\/$/, "")}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return response.ok;
  } catch {
    // Telemetry must never affect app behavior.
    return false;
  }
}

export async function trackAppLaunch(): Promise<void> {
  if (!(await canSendTelemetry())) return;

  const state = await readTelemetryState();
  if (!state.installedTracked) {
    const tracked = await trackTelemetryEvent("app_installed", { first_version: app.getVersion() });
    if (tracked) await writeTelemetryState({ ...state, installedTracked: true });
  }

  await trackTelemetryEvent("app_opened");
}

export function registerTelemetryIpc(): void {
  ipcMain.handle(
    "telemetry:track",
    (_event, eventName: string, properties?: Record<string, string | number | boolean>) => {
      void trackTelemetryEvent(eventName, properties);
    },
  );
}
