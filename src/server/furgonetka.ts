import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

type Environment = Record<string, string | undefined>;

export type FurgonetkaConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  encryptionKey: Buffer;
};

export type FurgonetkaTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

function required(env: Environment, name: string) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export function furgonetkaConfig(env: Environment = process.env): FurgonetkaConfig {
  const encodedKey = required(env, "FURGONETKA_TOKEN_ENCRYPTION_KEY");
  const encryptionKey = Buffer.from(encodedKey, "base64");
  if (encryptionKey.length !== 32)
    throw new Error("FURGONETKA_TOKEN_ENCRYPTION_KEY must be 32 bytes encoded as base64");
  return {
    clientId: required(env, "FURGONETKA_CLIENT_ID"),
    clientSecret: required(env, "FURGONETKA_CLIENT_SECRET"),
    redirectUri: required(env, "FURGONETKA_REDIRECT_URI"),
    encryptionKey,
  };
}

function base64url(value: Buffer | string) {
  return Buffer.from(value).toString("base64url");
}

export function createOAuthState(userId: string, config = furgonetkaConfig()) {
  const payload = base64url(JSON.stringify({ userId, exp: Date.now() + 10 * 60_000 }));
  const signature = createHmac("sha256", config.encryptionKey).update(payload).digest();
  return `${payload}.${base64url(signature)}`;
}

export function readOAuthState(state: string, config = furgonetkaConfig()) {
  const [payload, signature] = state.split(".");
  if (!payload || !signature) throw new Error("Nieprawidłowy stan autoryzacji.");
  const expected = createHmac("sha256", config.encryptionKey).update(payload).digest();
  const received = Buffer.from(signature, "base64url");
  if (received.length !== expected.length || !timingSafeEqual(received, expected))
    throw new Error("Nieprawidłowy stan autoryzacji.");
  const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
    userId?: unknown;
    exp?: unknown;
  };
  if (
    typeof decoded.userId !== "string" ||
    typeof decoded.exp !== "number" ||
    decoded.exp < Date.now()
  )
    throw new Error("Autoryzacja wygasła. Spróbuj ponownie.");
  return decoded.userId;
}

export function furgonetkaAuthorizationUrl(userId: string, config = furgonetkaConfig()) {
  const url = new URL("https://api.furgonetka.pl/oauth/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("scope", "api");
  url.searchParams.set("state", createOAuthState(userId, config));
  return url.toString();
}

async function tokenRequest(body: URLSearchParams, config = furgonetkaConfig()) {
  const response = await fetch("https://api.furgonetka.pl/oauth/token", {
    method: "POST",
    signal: AbortSignal.timeout(15_000),
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const result = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok)
    throw new Error("Furgonetka odrzuciła autoryzację. Spróbuj połączyć konto ponownie.");
  if (
    typeof result["access_token"] !== "string" ||
    typeof result["refresh_token"] !== "string" ||
    typeof result["expires_in"] !== "number"
  )
    throw new Error("Furgonetka zwróciła niepełne dane autoryzacji.");
  return {
    accessToken: result["access_token"],
    refreshToken: result["refresh_token"],
    expiresIn: result["expires_in"],
  } satisfies FurgonetkaTokens;
}

export function exchangeAuthorizationCode(code: string, config = furgonetkaConfig()) {
  return tokenRequest(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: config.redirectUri,
    }),
    config,
  );
}

export function refreshFurgonetkaToken(refreshToken: string, config = furgonetkaConfig()) {
  return tokenRequest(
    new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
    config,
  );
}

export function encryptFurgonetkaToken(value: string, config = furgonetkaConfig()) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", config.encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [base64url(iv), base64url(cipher.getAuthTag()), base64url(encrypted)].join(".");
}

export function decryptFurgonetkaToken(value: string, config = furgonetkaConfig()) {
  const [iv, tag, encrypted] = value.split(".");
  if (!iv || !tag || !encrypted) throw new Error("Nieprawidłowy zaszyfrowany token.");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    config.encryptionKey,
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function tokenExpiresAt(expiresIn: number) {
  return new Date(Date.now() + Math.max(60, expiresIn - 300) * 1000).toISOString();
}

type ShippingAccountRow = {
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  access_token_expires_at: string;
};

type ShippingAccountAdmin = {
  from(table: string): {
    select(columns: string): {
      eq(
        column: string,
        value: string,
      ): {
        eq(
          column: string,
          value: string,
        ): {
          maybeSingle(): Promise<{ data: ShippingAccountRow | null; error: unknown }>;
        };
      };
    };
    update(values: Record<string, unknown>): {
      eq(
        column: string,
        value: string,
      ): {
        eq(column: string, value: string): Promise<{ error: unknown }>;
      };
    };
  };
};

export type FurgonetkaAddress = {
  name: string;
  company?: string;
  email?: string;
  phone: string;
  street: string;
  postcode: string;
  city: string;
  country_code: "PL";
  county: string;
  point?: string;
};

export type FurgonetkaPackage = {
  pickup: FurgonetkaAddress;
  receiver: FurgonetkaAddress;
  service_id: number;
  parcels: Array<{
    height: number;
    width: number;
    depth: number;
    weight: number;
    quantity: 1;
    type: "package";
  }>;
  additional_services: Record<string, never>;
  user_reference_number: string;
  type: "package";
};

type FurgonetkaService = { id: number; service: string; owner?: string };
type FurgonetkaPoint = {
  point_id?: string;
  code?: string;
  address?: { street?: string; postcode?: string; city?: string };
};

export async function furgonetkaAccessToken(
  admin: ShippingAccountAdmin,
  userId: string,
  config = furgonetkaConfig(),
) {
  const query = await admin
    .from("shipping_provider_accounts")
    .select("access_token_encrypted,refresh_token_encrypted,access_token_expires_at")
    .eq("user_id", userId)
    .eq("provider", "furgonetka")
    .maybeSingle();
  if (query.error) throw new Error("Nie udało się odczytać połączenia z Furgonetką.");
  if (!query.data) throw new Error("Najpierw połącz konto Furgonetki w Ustawieniach.");

  if (new Date(query.data.access_token_expires_at).getTime() > Date.now() + 60_000)
    return decryptFurgonetkaToken(query.data.access_token_encrypted, config);

  const tokens = await refreshFurgonetkaToken(
    decryptFurgonetkaToken(query.data.refresh_token_encrypted, config),
    config,
  );
  const update = await admin
    .from("shipping_provider_accounts")
    .update({
      access_token_encrypted: encryptFurgonetkaToken(tokens.accessToken, config),
      refresh_token_encrypted: encryptFurgonetkaToken(tokens.refreshToken, config),
      access_token_expires_at: tokenExpiresAt(tokens.expiresIn),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("provider", "furgonetka");
  if (update.error) throw new Error("Nie udało się zapisać odświeżonego połączenia Furgonetki.");
  return tokens.accessToken;
}

async function apiRequest<T>(
  accessToken: string,
  path: string,
  init: RequestInit = {},
  version = 1,
) {
  const response = await fetch(`https://api.furgonetka.pl${path}`, {
    ...init,
    signal: AbortSignal.timeout(20_000),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: `application/vnd.furgonetka.v${version}+json`,
      "X-Language": "pl_PL",
      ...(init.body ? { "Content-Type": `application/vnd.furgonetka.v${version}+json` } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) {
    const result = (await response.json().catch(() => ({}))) as {
      message?: string;
      details?: string;
      errors?: Array<{ message?: string; details?: string }>;
    };
    const first = result.errors?.[0];
    throw new Error(
      first?.details ||
        first?.message ||
        result.details ||
        result.message ||
        "Furgonetka odrzuciła dane przesyłki.",
    );
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function getFurgonetkaInpostService(accessToken: string) {
  const result = await apiRequest<{ services?: FurgonetkaService[] }>(
    accessToken,
    "/account/services",
  );
  const services = (result.services ?? []).filter((item) => item.service === "inpost");
  const service = services.find((item) => item.owner === "furgonetka") ?? services[0];
  if (!service) throw new Error("Na koncie Furgonetki nie ma aktywnej usługi InPost.");
  return service.id;
}

export async function getFurgonetkaPoint(accessToken: string, pointId: string) {
  const result = await apiRequest<{ points?: FurgonetkaPoint[] }>(accessToken, "/points/map", {
    method: "POST",
    body: JSON.stringify({
      location: { search_phrase: pointId },
      filters: { services: ["inpost"], point_id: pointId, limit: "1" },
    }),
  });
  const point = result.points?.find((item) => item.point_id === pointId || item.code === pointId);
  if (!point?.address?.street || !point.address.postcode || !point.address.city)
    throw new Error("Wybrany Paczkomat nie istnieje lub jest chwilowo niedostępny.");
  return point.address as { street: string; postcode: string; city: string };
}

export function furgonetkaParcel(template: "small" | "medium" | "large") {
  const dimensions = {
    small: { height: 8, width: 38, depth: 64, weight: 5 },
    medium: { height: 19, width: 38, depth: 64, weight: 10 },
    large: { height: 41, width: 38, depth: 64, weight: 15 },
  }[template];
  return { ...dimensions, quantity: 1 as const, type: "package" as const };
}

export async function validateFurgonetkaPackage(
  accessToken: string,
  packageData: FurgonetkaPackage,
) {
  await apiRequest<void>(
    accessToken,
    "/packages/validate",
    { method: "POST", body: JSON.stringify(packageData) },
    2,
  );
}

export async function quoteFurgonetkaPackage(accessToken: string, packageData: FurgonetkaPackage) {
  const result = await apiRequest<{
    services_prices?: Array<{
      service_id?: number;
      available?: boolean;
      errors?: Array<{ message?: string }>;
      pricing?: { price_gross?: number | string; currency?: string };
    }>;
  }>(
    accessToken,
    "/packages/calculate-price",
    {
      method: "POST",
      body: JSON.stringify({
        package: packageData,
        services: { service_id: [packageData.service_id] },
      }),
    },
    2,
  );
  const quote = result.services_prices?.find((item) => item.service_id === packageData.service_id);
  if (!quote?.available) throw new Error(quote?.errors?.[0]?.message || "Brak wyceny InPost.");
  const gross = Number(quote.pricing?.price_gross);
  if (!Number.isFinite(gross) || gross <= 0) throw new Error("Furgonetka nie zwróciła ceny.");
  return {
    priceGrosz: Math.round(gross * 100),
    currency: quote.pricing?.currency || "PLN",
  };
}

export async function createFurgonetkaPackage(accessToken: string, packageData: FurgonetkaPackage) {
  const created = await apiRequest<{ package_id?: string | number }>(
    accessToken,
    "/packages",
    { method: "POST", body: JSON.stringify(packageData) },
    2,
  );
  if (created.package_id === undefined) throw new Error("Nie udało się zapisać przesyłki.");
  return String(created.package_id);
}

export async function orderFurgonetkaPackage(accessToken: string, packageId: string) {
  const commandId = randomUUID();
  await apiRequest<{ uuid?: string }>(accessToken, `/order-commands/${commandId}`, {
    method: "PUT",
    body: JSON.stringify({
      packages: [{ id: packageId }],
      label: { file_format: "pdf", page_format: "a6" },
    }),
  });
  return commandId;
}

export async function getFurgonetkaPackage(accessToken: string, packageId: string) {
  return apiRequest<{
    state?: string;
    status?: string;
    tracking_number?: string;
    trackingNumber?: string;
  }>(accessToken, `/packages/${encodeURIComponent(packageId)}`, {}, 2);
}

export async function getFurgonetkaLabel(accessToken: string, packageId: string) {
  const response = await fetch(
    `https://api.furgonetka.pl/packages/${encodeURIComponent(packageId)}/label`,
    {
      signal: AbortSignal.timeout(20_000),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/pdf",
        "X-Language": "pl_PL",
      },
    },
  );
  if (!response.ok) throw new Error("Etykieta nie jest jeszcze gotowa.");
  return response;
}
