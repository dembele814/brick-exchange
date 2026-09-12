import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
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
