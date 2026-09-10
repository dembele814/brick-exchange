import type { SupabaseClient } from "@supabase/supabase-js";

type EmailMode = "test" | "live";

type EmailConfig = {
  apiKey: string;
  from: string;
  mode: EmailMode;
  testRecipient?: string;
  appUrl: string;
};

type OutboxRow = {
  id: number;
  user_id: string;
  kind: string;
  subject: string;
  body: string;
  href: string | null;
  attempt_count: number;
};

export type EmailWorkerSummary = {
  claimed: number;
  sent: number;
  failed: number;
  skipped: number;
};

const isEnabled = (value: string | undefined) => value === "true";

function emailAddress(value: string, name: string) {
  if (!/^\S+@\S+\.\S+$/.test(value)) throw new Error(`${name} is invalid`);
  return value;
}

export function emailConfig(env: Record<string, string | undefined> = process.env): EmailConfig {
  if (!isEnabled(env["EMAIL_ENABLED"])) throw new Error("Transactional email is disabled");
  const mode = env["EMAIL_MODE"] === "live" ? "live" : env["EMAIL_MODE"] === "test" ? "test" : null;
  if (!mode) throw new Error("EMAIL_MODE must be test or live");
  if (mode === "live" && !isEnabled(env["EMAIL_LIVE_ENABLED"]))
    throw new Error("Live transactional email requires EMAIL_LIVE_ENABLED=true");
  const apiKey = env["RESEND_API_KEY"];
  if (!apiKey?.startsWith("re_")) throw new Error("RESEND_API_KEY is invalid");
  const from = env["EMAIL_FROM"];
  if (!from || !/<\S+@\S+\.\S+>$/.test(from)) throw new Error("EMAIL_FROM is invalid");
  const appUrl = env["APP_URL"]?.replace(/\/$/, "");
  if (!appUrl) throw new Error("APP_URL is missing");
  if (mode === "live" && !appUrl.startsWith("https://"))
    throw new Error("Live transactional email requires an HTTPS APP_URL");
  const testRecipient = env["EMAIL_TEST_RECIPIENT"];
  if (mode === "test" && !testRecipient)
    throw new Error("EMAIL_TEST_RECIPIENT is required in test mode");
  return {
    apiKey,
    from,
    mode,
    ...(testRecipient ? { testRecipient: emailAddress(testRecipient, "EMAIL_TEST_RECIPIENT") } : {}),
    appUrl,
  };
}

export function emailWorkerSecret(env: Record<string, string | undefined> = process.env) {
  const secret = env["EMAIL_WORKER_SECRET"] || env["RECONCILIATION_SECRET"];
  if (!secret || secret.length < 32) throw new Error("EMAIL_WORKER_SECRET is not configured");
  return secret;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function notificationEmail(row: Pick<OutboxRow, "subject" | "body" | "href">, config: EmailConfig) {
  const url = row.href ? new URL(row.href, `${config.appUrl}/`).toString() : config.appUrl;
  const subject = `Klockownia: ${row.subject}`;
  const text = `${row.body}\n\nSprawdź szczegóły: ${url}\n\nKlockownia`;
  const html = `<!doctype html><html lang="pl"><body style="margin:0;background:#f5f7fb;font-family:Arial,sans-serif;color:#172033"><div style="max-width:560px;margin:32px auto;background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:32px"><p style="margin:0 0 20px;font-size:22px;font-weight:700;color:#2563eb">Klockownia</p><h1 style="margin:0 0 12px;font-size:22px">${escapeHtml(row.subject)}</h1><p style="margin:0 0 24px;line-height:1.6">${escapeHtml(row.body)}</p><a href="${escapeHtml(url)}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;border-radius:10px;padding:12px 18px;font-weight:700">Sprawdź szczegóły</a><p style="margin:28px 0 0;color:#64748b;font-size:12px">Automatyczna wiadomość dotycząca Twojego konta w Klockowni.</p></div></body></html>`;
  return { subject, text, html };
}

async function sendWithResend(config: EmailConfig, row: OutboxRow, recipient: string, fetcher: typeof fetch) {
  const content = notificationEmail(row, config);
  const response = await fetcher("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `klockownia-email-${row.id}-v1`,
    },
    body: JSON.stringify({
      from: config.from,
      to: [config.mode === "test" ? config.testRecipient : recipient],
      subject: config.mode === "test" ? `[TEST] ${content.subject}` : content.subject,
      text: content.text,
      html: content.html,
      tags: [
        { name: "source", value: "notification" },
        { name: "kind", value: row.kind.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50) },
      ],
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!response.ok || !payload.id) throw new Error(payload.message || `Resend returned ${response.status}`);
  return payload.id;
}

function retryAt(attempt: number) {
  const minutes = Math.min(360, 2 ** Math.min(attempt, 8));
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

export async function processEmailOutbox(
  admin: SupabaseClient,
  config: EmailConfig,
  batchSize = 25,
  fetcher: typeof fetch = fetch,
): Promise<EmailWorkerSummary> {
  const lockToken = crypto.randomUUID();
  const { data, error } = await admin.rpc("claim_email_outbox", {
    p_limit: Math.max(1, Math.min(batchSize, 100)),
    p_lock_token: lockToken,
  });
  if (error) throw error;
  const rows = (data ?? []) as OutboxRow[];
  const summary: EmailWorkerSummary = { claimed: rows.length, sent: 0, failed: 0, skipped: 0 };

  for (const row of rows) {
    try {
      const { data: account, error: accountError } = await admin.auth.admin.getUserById(row.user_id);
      const recipient = account.user?.email;
      if (accountError || !recipient) {
        await admin.from("email_outbox").update({ status: "failed", last_error: "Konto nie ma adresu e-mail", locked_until: null, lock_token: null }).eq("id", row.id).eq("lock_token", lockToken);
        summary.skipped += 1;
        continue;
      }
      const providerId = await sendWithResend(config, row, recipient, fetcher);
      const { error: updateError } = await admin.from("email_outbox").update({
        status: "sent",
        provider_message_id: providerId,
        sent_at: new Date().toISOString(),
        last_error: null,
        locked_until: null,
        lock_token: null,
      }).eq("id", row.id).eq("lock_token", lockToken);
      if (updateError) throw updateError;
      summary.sent += 1;
    } catch (cause) {
      const permanentlyFailed = row.attempt_count >= 5;
      await admin.from("email_outbox").update({
        status: permanentlyFailed ? "failed" : "pending",
        next_attempt_at: retryAt(row.attempt_count),
        last_error: cause instanceof Error ? cause.message.slice(0, 500) : "Nieznany błąd wysyłki",
        locked_until: null,
        lock_token: null,
      }).eq("id", row.id).eq("lock_token", lockToken);
      summary.failed += 1;
    }
  }
  return summary;
}
