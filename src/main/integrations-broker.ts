const brokerUrl = normalizeBrokerUrl(process.env.PLAYHEAD_INTEGRATIONS_BROKER_URL || "");

type BrokerErrorPayload = {
  error?: string;
};

function normalizeBrokerUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

export function hasIntegrationsBroker(): boolean {
  return Boolean(brokerUrl);
}

export async function postIntegrationsBroker<T>(path: string, body: unknown): Promise<T> {
  if (!brokerUrl) throw new Error("Integration broker is not configured.");

  const response = await fetch(`${brokerUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => null)) as (T & BrokerErrorPayload) | null;

  if (!response.ok) {
    throw new Error(data?.error || `Integration broker request failed (${response.status}).`);
  }

  if (!data) throw new Error("Integration broker returned an empty response.");
  return data;
}
