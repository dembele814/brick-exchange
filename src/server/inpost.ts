import { createHmac, timingSafeEqual } from "node:crypto";

export type InpostMode = "stage" | "live";
export type ParcelTemplate = "small" | "medium" | "large";
type Environment = Record<string, string | undefined>;

export type InpostConfig = {
  mode: InpostMode;
  liveMode: boolean;
  apiUrl: string;
  token: string;
  organizationId: string;
  webhookSecret: string;
  webhookSignedWithTimestamp: boolean;
};

export type ShipmentInput = {
  receiver: { email: string; phone: string; firstName: string; lastName: string };
  parcelLockerId: string;
  parcelTemplate: ParcelTemplate;
  reference: string;
};

type PointResponse = { name?: unknown; id?: unknown; status?: unknown; type?: unknown };
type ShipmentResponse = { id?: unknown; tracking_number?: unknown; status?: unknown };
const pointPattern = /^[A-Z0-9_-]{3,40}$/i;

function required(env: Environment, name: string) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export function inpostConfig(env: Environment = process.env): InpostConfig {
  const mode = (env["INPOST_MODE"] ?? "stage").trim().toLowerCase();
  if (mode !== "stage" && mode !== "live") throw new Error("INPOST_MODE must be stage or live");
  const liveMode = mode === "live";
  if (liveMode && env["INPOST_LIVE_ENABLED"] !== "true")
    throw new Error("Production InPost shipping is disabled");
  const token = required(env, liveMode ? "INPOST_LIVE_TOKEN" : "INPOST_STAGE_TOKEN");
  const organizationId = required(
    env,
    liveMode ? "INPOST_LIVE_ORGANIZATION_ID" : "INPOST_STAGE_ORGANIZATION_ID",
  );
  const webhookSecret = required(
    env,
    liveMode ? "INPOST_LIVE_WEBHOOK_SECRET" : "INPOST_STAGE_WEBHOOK_SECRET",
  );
  return {
    mode,
    liveMode,
    token,
    organizationId,
    webhookSecret,
    webhookSignedWithTimestamp:
      (env["INPOST_WEBHOOK_SIGNATURE_PAYLOAD"] ?? "timestamp_body") === "timestamp_body",
    apiUrl: liveMode
      ? "https://api-shipx-pl.easypack24.net/v1"
      : "https://sandbox-api-shipx-pl.easypack24.net/v1",
  };
}

async function parseInpostError(response: Response) {
  try {
    const body = (await response.json()) as { message?: unknown; error?: unknown };
    const message = typeof body.message === "string" ? body.message : body.error;
    if (typeof message === "string") return message.slice(0, 300);
  } catch {
    // The HTTP status below is safe to show and never contains a credential.
  }
  return `HTTP ${response.status}`;
}

async function shipxRequest(config: InpostConfig, path: string, init: RequestInit = {}) {
  const response = await fetch(`${config.apiUrl}${path}`, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(15_000),
    headers: {
      Authorization: `Bearer ${config.token}`,
      "X-Request-Id": crypto.randomUUID(),
      ...init.headers,
    },
  });
  if (!response.ok) throw new Error(`InPost: ${await parseInpostError(response)}`);
  return response;
}

export async function validateInpostPoint(pointId: string, config?: InpostConfig) {
  const normalized = pointId.trim().toUpperCase();
  if (!pointPattern.test(normalized)) throw new Error("Nieprawidłowy kod punktu InPost.");
  const mode = config?.mode ?? (process.env["INPOST_MODE"] === "live" ? "live" : "stage");
  const apiUrl =
    config?.apiUrl ??
    (mode === "live"
      ? "https://api-shipx-pl.easypack24.net/v1"
      : "https://sandbox-api-shipx-pl.easypack24.net/v1");
  const response = config
    ? await shipxRequest(config, `/points/${encodeURIComponent(normalized)}`)
    : await fetch(`${apiUrl}/points/${encodeURIComponent(normalized)}`, {
        headers: { "X-Request-Id": crypto.randomUUID() },
        signal: AbortSignal.timeout(10_000),
      });
  if (!response.ok) throw new Error("Punkt InPost nie istnieje lub jest niedostępny.");
  const point = (await response.json()) as PointResponse;
  const returnedId = String(point.name ?? point.id ?? "").toUpperCase();
  if (returnedId !== normalized) throw new Error("Punkt InPost nie istnieje.");
  if (String(point.status ?? "Operating").toLowerCase() === "closed")
    throw new Error("Wybrany punkt InPost jest zamknięty.");
  return { id: normalized, type: String(point.type ?? "") };
}

export async function createInpostShipment(input: ShipmentInput, config = inpostConfig()) {
  await validateInpostPoint(input.parcelLockerId, config);
  const response = await shipxRequest(
    config,
    `/organizations/${encodeURIComponent(config.organizationId)}/shipments`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        receiver: {
          email: input.receiver.email,
          phone: input.receiver.phone,
          first_name: input.receiver.firstName,
          last_name: input.receiver.lastName,
        },
        parcels: [{ template: input.parcelTemplate }],
        service: "inpost_locker_standard",
        custom_attributes: { target_point: input.parcelLockerId.trim().toUpperCase() },
        reference: input.reference,
      }),
    },
  );
  const shipment = (await response.json()) as ShipmentResponse;
  if (typeof shipment.id !== "number" && typeof shipment.id !== "string")
    throw new Error("InPost nie zwrócił identyfikatora przesyłki.");
  return {
    id: String(shipment.id),
    trackingNumber:
      typeof shipment.tracking_number === "string" ? shipment.tracking_number : null,
    status: typeof shipment.status === "string" ? shipment.status : "created",
  };
}

export async function getInpostShipment(shipmentId: string, config = inpostConfig()) {
  const response = await shipxRequest(config, `/shipments/${encodeURIComponent(shipmentId)}`);
  return (await response.json()) as ShipmentResponse;
}

export async function getInpostLabel(shipmentId: string, config = inpostConfig()) {
  return shipxRequest(config, `/shipments/${encodeURIComponent(shipmentId)}/label?format=A6`, {
    headers: { Accept: "application/pdf" },
  });
}

export function verifyInpostWebhook(
  rawBody: string,
  signature: string,
  timestamp: string | null,
  secret: string,
) {
  const signedBody = timestamp ? `${timestamp}.${rawBody}` : rawBody;
  const expected = createHmac("sha256", secret).update(signedBody, "utf8").digest();
  const received = Buffer.from(signature, "base64");
  return received.length === expected.length && timingSafeEqual(received, expected);
}
