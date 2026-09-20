import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";
import { z } from "zod";
import { emailConfig } from "@/server/email";
import { furgonetkaConfig } from "@/server/furgonetka";
import { inpostConfig } from "@/server/inpost";
import { paymentConfig, refundPayment } from "@/server/payments";
import { getSupabaseAdmin, hasSupabaseAdminConfig } from "@/server/supabase-admin";
import { reconcileStripeMoney } from "@/server/reconciliation";

const adminAction = z.discriminatedUnion("action", [
  z.object({ action: z.literal("close_problem"), orderId: z.string().uuid() }),
  z.object({ action: z.literal("hide_reported_listing"), reportId: z.string().uuid() }),
  z.object({
    action: z.literal("moderate_listing"),
    listingId: z.string().uuid(),
    status: z.enum(["active", "hidden"]),
  }),
  z.object({
    action: z.literal("ban_user"),
    userId: z.string().uuid(),
    duration: z.enum(["24h", "7d", "30d", "permanent"]),
    reason: z.string().trim().min(3).max(500),
  }),
  z.object({ action: z.literal("unban_user"), userId: z.string().uuid() }),
  z.object({
    action: z.literal("delete_user"),
    userId: z.string().uuid(),
    confirmation: z.string().trim().min(3).max(40),
  }),
  z.object({ action: z.literal("refund_order"), orderId: z.string().uuid() }),
  z.object({ action: z.literal("reconcile_money") }),
]);

const suspension = {
  "24h": { auth: "24h", milliseconds: 24 * 60 * 60 * 1000 },
  "7d": { auth: "168h", milliseconds: 7 * 24 * 60 * 60 * 1000 },
  "30d": { auth: "720h", milliseconds: 30 * 24 * 60 * 60 * 1000 },
  permanent: { auth: "876000h", milliseconds: null },
} as const;

async function recordAudit(
  actorId: string,
  action: string,
  targetType: "user" | "listing" | "order" | "report" | "system",
  targetId: string | null,
  details: Record<string, unknown> = {},
) {
  const { error } = await getSupabaseAdmin().from("admin_audit_log").insert({
    actor_id: actorId,
    action,
    target_type: targetType,
    target_id: targetId,
    details,
  });
  if (error) throw error;
}

async function safeTargetUser(actorId: string, targetId: string) {
  if (actorId === targetId) throw new Error("Nie możesz moderować własnego konta.");
  const { data, error } = await getSupabaseAdmin().auth.admin.getUserById(targetId);
  if (error || !data.user) throw new Error("Nie znaleziono użytkownika.");
  if (data.user.app_metadata?.["klockownia_admin"] === true)
    throw new Error("Nie można moderować innego administratora.");
  return data.user;
}

async function adminUser(request: Request) {
  if (!hasSupabaseAdminConfig()) return null;
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return null;
  const { data, error } = await getSupabaseAdmin().auth.getUser(token);
  if (error || data.user?.app_metadata?.["klockownia_admin"] !== true) return null;
  return data.user;
}

export const Route = createFileRoute("/api/admin")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await adminUser(request);
        if (!user) return Response.json({ error: "Brak dostępu administratora." }, { status: 403 });
        const db = getSupabaseAdmin();
        const [
          events,
          reports,
          furgonetkaAccounts,
          profiles,
          moderation,
          listings,
          orders,
          audit,
          authUsers,
          userCount,
          listingCount,
          orderCount,
        ] = await Promise.all([
          db
            .from("order_events")
            .select(
              "id,order_id,event_type,payload,created_at,orders(id,status,payment_status,amount_grosz,buyer:profiles!orders_buyer_id_fkey(username),seller:profiles!orders_seller_id_fkey(username))",
            )
            .in("event_type", ["problem_reported", "problem_resolved"])
            .order("id", { ascending: false }),
          db
            .from("listing_reports")
            .select(
              "id,reason,details,created_at,listings(id,title,status,profiles!listings_seller_id_fkey(username))",
            )
            .order("created_at", { ascending: false })
            .limit(100),
          db
            .from("shipping_provider_accounts")
            .select("user_id")
            .eq("provider", "furgonetka")
            .limit(1),
          db
            .from("profiles")
            .select("id,username,country,city,profile_visible,vacation_mode,created_at")
            .order("created_at", { ascending: false })
            .limit(200),
          db.from("account_moderation").select("user_id,status,suspended_until,reason,updated_at"),
          db
            .from("listings")
            .select(
              "id,title,status,price_grosz,created_at,seller_id,profiles!listings_seller_id_fkey(username)",
            )
            .order("created_at", { ascending: false })
            .limit(100),
          db
            .from("orders")
            .select(
              "id,status,payment_status,amount_grosz,created_at,buyer_id,seller_id,buyer:profiles!orders_buyer_id_fkey(username),seller:profiles!orders_seller_id_fkey(username)",
            )
            .order("created_at", { ascending: false })
            .limit(100),
          db
            .from("admin_audit_log")
            .select("id,actor_id,action,target_type,target_id,details,created_at")
            .order("created_at", { ascending: false })
            .limit(100),
          db.auth.admin.listUsers({ page: 1, perPage: 200 }),
          db.from("profiles").select("id", { count: "exact", head: true }),
          db.from("listings").select("id", { count: "exact", head: true }),
          db.from("orders").select("id", { count: "exact", head: true }),
        ]);
        if (
          events.error ||
          reports.error ||
          profiles.error ||
          moderation.error ||
          listings.error ||
          orders.error ||
          audit.error ||
          authUsers.error
        )
          return Response.json({ error: "Nie udało się pobrać panelu." }, { status: 500 });
        const latest = new Map<string, (typeof events.data)[number]>();
        for (const event of events.data ?? [])
          if (!latest.has(event.order_id)) latest.set(event.order_id, event);
        let stripeMode: "test" | "live" | "unconfigured" = "unconfigured";
        let emailMode: "test" | "live" | "unconfigured" = "unconfigured";
        let shippingMode: "stage" | "live" | "unconfigured" = "unconfigured";
        let shippingProvider: "furgonetka" | "shipx" | null = null;
        let appOrigin: string | null = null;
        try {
          stripeMode = paymentConfig().liveMode ? "live" : "test";
        } catch {
          // The panel remains useful for moderation when payments are disabled.
        }
        try {
          emailMode = emailConfig().mode;
        } catch {
          // A missing email integration must be visible without breaking moderation.
        }
        try {
          furgonetkaConfig();
          if (!furgonetkaAccounts.error && (furgonetkaAccounts.data?.length ?? 0) > 0) {
            shippingMode = "live";
            shippingProvider = "furgonetka";
          }
        } catch {
          // Fall back to a direct ShipX configuration below.
        }
        if (shippingMode === "unconfigured") {
          try {
            shippingMode = inpostConfig().mode;
            shippingProvider = "shipx";
          } catch {
            // A missing shipping integration must be visible without breaking moderation.
          }
        }
        try {
          appOrigin = new URL(process.env["APP_URL"] ?? "").origin;
        } catch {
          // Invalid or missing APP_URL is reported as unconfigured below.
        }
        const authById = new Map(authUsers.data.users.map((account) => [account.id, account]));
        const moderationById = new Map(
          (moderation.data ?? []).map((entry) => [entry.user_id, entry]),
        );
        const listingCounts = new Map<string, number>();
        const orderCounts = new Map<string, number>();
        for (const item of listings.data ?? [])
          listingCounts.set(item.seller_id, (listingCounts.get(item.seller_id) ?? 0) + 1);
        for (const order of orders.data ?? []) {
          orderCounts.set(order.buyer_id, (orderCounts.get(order.buyer_id) ?? 0) + 1);
          orderCounts.set(order.seller_id, (orderCounts.get(order.seller_id) ?? 0) + 1);
        }
        return Response.json({
          problems: [...latest.values()].filter((event) => event.event_type === "problem_reported"),
          reports: reports.data ?? [],
          users: (profiles.data ?? []).map((profile) => {
            const account = authById.get(profile.id);
            const moderationEntry = moderationById.get(profile.id);
            return {
              ...profile,
              email: account?.email ?? "Brak adresu",
              lastSignInAt: account?.last_sign_in_at ?? null,
              isAdmin: account?.app_metadata?.["klockownia_admin"] === true,
              moderation: moderationEntry ?? {
                status: "active",
                suspended_until: null,
                reason: null,
                updated_at: null,
              },
              listingCount: listingCounts.get(profile.id) ?? 0,
              orderCount: orderCounts.get(profile.id) ?? 0,
            };
          }),
          listings: listings.data ?? [],
          orders: orders.data ?? [],
          audit: audit.data ?? [],
          stats: {
            users: userCount.count ?? 0,
            listings: listingCount.count ?? 0,
            activeListings: (listings.data ?? []).filter((item) => item.status === "active").length,
            orders: orderCount.count ?? 0,
            openReports: reports.data?.length ?? 0,
          },
          stripeMode,
          emailMode,
          shippingMode,
          shippingProvider,
          appOrigin,
        });
      },
      PATCH: async ({ request }) => {
        const user = await adminUser(request);
        if (!user) return Response.json({ error: "Brak dostępu administratora." }, { status: 403 });
        const parsed = adminAction.safeParse(await request.json().catch(() => null));
        if (!parsed.success)
          return Response.json({ error: "Nieprawidłowa operacja." }, { status: 400 });
        const db = getSupabaseAdmin();
        const input = parsed.data;

        if (input.action === "ban_user") {
          let target;
          try {
            target = await safeTargetUser(user.id, input.userId);
          } catch (cause) {
            return Response.json(
              { error: cause instanceof Error ? cause.message : "Nie można zablokować konta." },
              { status: 409 },
            );
          }
          const setting = suspension[input.duration];
          const suspendedUntil = setting.milliseconds
            ? new Date(Date.now() + setting.milliseconds).toISOString()
            : null;
          const { error: authError } = await db.auth.admin.updateUserById(input.userId, {
            ban_duration: setting.auth,
          });
          if (authError)
            return Response.json({ error: "Nie udało się zablokować logowania." }, { status: 500 });
          const { error: moderationError } = await db.from("account_moderation").upsert({
            user_id: input.userId,
            status: input.duration === "permanent" ? "permanent" : "suspended",
            suspended_until: suspendedUntil,
            reason: input.reason,
            updated_by: user.id,
            updated_at: new Date().toISOString(),
          });
          if (moderationError)
            return Response.json({ error: "Nie udało się zapisać blokady." }, { status: 500 });
          await db
            .from("listings")
            .update({ status: "hidden" })
            .eq("seller_id", input.userId)
            .eq("status", "active");
          await db.from("notifications").insert({
            user_id: input.userId,
            kind: "system",
            title:
              input.duration === "permanent" ? "Konto zostało zablokowane" : "Konto zawieszone",
            body:
              input.duration === "permanent"
                ? `Konto zostało zablokowane za naruszenie zasad: ${input.reason}`
                : `Konto zostało czasowo zawieszone: ${input.reason}`,
            href: "/regulamin",
          });
          await recordAudit(user.id, "ban_user", "user", input.userId, {
            duration: input.duration,
            reason: input.reason,
            email: target.email ?? null,
          });
          return Response.json({ ok: true });
        }

        if (input.action === "unban_user") {
          try {
            await safeTargetUser(user.id, input.userId);
          } catch (cause) {
            return Response.json(
              { error: cause instanceof Error ? cause.message : "Nie można odblokować konta." },
              { status: 409 },
            );
          }
          const { error: authError } = await db.auth.admin.updateUserById(input.userId, {
            ban_duration: "none",
          });
          if (authError)
            return Response.json({ error: "Nie udało się odblokować logowania." }, { status: 500 });
          const { error: moderationError } = await db.from("account_moderation").upsert({
            user_id: input.userId,
            status: "active",
            suspended_until: null,
            reason: null,
            updated_by: user.id,
            updated_at: new Date().toISOString(),
          });
          if (moderationError)
            return Response.json({ error: "Nie udało się zapisać zmiany." }, { status: 500 });
          await recordAudit(user.id, "unban_user", "user", input.userId);
          return Response.json({ ok: true });
        }

        if (input.action === "delete_user") {
          try {
            await safeTargetUser(user.id, input.userId);
          } catch (cause) {
            return Response.json(
              { error: cause instanceof Error ? cause.message : "Nie można usunąć konta." },
              { status: 409 },
            );
          }
          const profile = await db
            .from("profiles")
            .select("username")
            .eq("id", input.userId)
            .maybeSingle();
          if (profile.error || !profile.data)
            return Response.json({ error: "Nie znaleziono profilu." }, { status: 404 });
          if (
            profile.data.username.toLocaleLowerCase("pl") !==
            input.confirmation.toLocaleLowerCase("pl")
          )
            return Response.json({ error: "Nazwa użytkownika nie zgadza się." }, { status: 400 });
          const relatedOrders = await db
            .from("orders")
            .select("id", { count: "exact", head: true })
            .or(`buyer_id.eq.${input.userId},seller_id.eq.${input.userId}`);
          if ((relatedOrders.count ?? 0) > 0)
            return Response.json(
              {
                error:
                  "Konta z historią transakcji nie można usunąć. Zablokuj je na stałe, aby zachować rozliczenia i reklamacje.",
              },
              { status: 409 },
            );
          const ownedListings = await db
            .from("listings")
            .select("id")
            .eq("seller_id", input.userId);
          const listingIds = (ownedListings.data ?? []).map((item) => item.id);
          await db.from("messages").delete().eq("sender_id", input.userId);
          if (listingIds.length) {
            await db.from("conversations").delete().in("listing_id", listingIds);
            await db.from("listings").delete().in("id", listingIds);
          }
          const { error: deleteError } = await db.auth.admin.deleteUser(input.userId);
          if (deleteError)
            return Response.json({ error: "Nie udało się usunąć konta." }, { status: 500 });
          await recordAudit(user.id, "delete_user", "user", input.userId, {
            username: profile.data.username,
          });
          return Response.json({ ok: true });
        }

        if (input.action === "moderate_listing") {
          const listing = await db
            .from("listings")
            .select("id,seller_id,status,title")
            .eq("id", input.listingId)
            .maybeSingle();
          if (listing.error || !listing.data)
            return Response.json({ error: "Nie znaleziono oferty." }, { status: 404 });
          if (input.status === "active") {
            const ownerStatus = await db
              .from("account_moderation")
              .select("status,suspended_until")
              .eq("user_id", listing.data.seller_id)
              .maybeSingle();
            const blocked =
              ownerStatus.data?.status === "permanent" ||
              (ownerStatus.data?.status === "suspended" &&
                new Date(ownerStatus.data.suspended_until ?? 0).getTime() > Date.now());
            if (blocked)
              return Response.json(
                { error: "Nie można aktywować oferty zablokowanego użytkownika." },
                { status: 409 },
              );
          }
          const { error: listingError } = await db
            .from("listings")
            .update({ status: input.status })
            .eq("id", input.listingId)
            .in("status", ["active", "hidden"]);
          if (listingError)
            return Response.json({ error: "Nie udało się zmienić oferty." }, { status: 500 });
          await recordAudit(user.id, `listing_${input.status}`, "listing", input.listingId, {
            title: listing.data.title,
          });
          return Response.json({ ok: true });
        }

        if (input.action === "reconcile_money") {
          try {
            const config = paymentConfig();
            const summary = await reconcileStripeMoney(db, new Stripe(config.key), config.liveMode);
            await recordAudit(user.id, "reconcile_money", "system", null, summary);
            return Response.json({ ok: true, summary });
          } catch {
            return Response.json(
              { error: "Nie udało się uzgodnić operacji Stripe." },
              { status: 503 },
            );
          }
        }

        if (input.action === "hide_reported_listing") {
          const report = await db
            .from("listing_reports")
            .select("listing_id,listings(seller_id)")
            .eq("id", input.reportId)
            .maybeSingle();
          if (report.error || !report.data)
            return Response.json({ error: "Nie znaleziono zgłoszenia." }, { status: 404 });
          const listing = Array.isArray(report.data.listings)
            ? report.data.listings[0]
            : report.data.listings;
          const hidden = await db
            .from("listings")
            .update({ status: "hidden" })
            .eq("id", report.data.listing_id)
            .in("status", ["active", "hidden"]);
          if (hidden.error)
            return Response.json({ error: "Nie udało się ukryć oferty." }, { status: 500 });
          if (listing?.seller_id)
            await db.from("notifications").insert({
              user_id: listing.seller_id,
              kind: "system",
              title: "Oferta została ukryta",
              body: "Administrator ukrył ofertę po otrzymanym zgłoszeniu. Sprawdź opis i zdjęcia przed ponowną publikacją.",
              href: "/profil",
            });
          await recordAudit(user.id, "hide_reported_listing", "report", input.reportId, {
            listing_id: report.data.listing_id,
          });
          return Response.json({ ok: true });
        }

        const order = await db
          .from("orders")
          .select(
            "id,listing_id,buyer_id,seller_id,status,payment_status,stripe_payment_intent_id,stripe_livemode",
          )
          .eq("id", input.orderId)
          .maybeSingle();
        if (order.error || !order.data)
          return Response.json({ error: "Nie znaleziono zamówienia." }, { status: 404 });

        if (input.action === "close_problem") {
          await db.from("order_events").insert({
            order_id: order.data.id,
            actor_id: user.id,
            event_type: "problem_resolved",
            payload: { resolved_by: "admin" },
          });
          await db.from("notifications").insert([
            {
              user_id: order.data.buyer_id,
              kind: "system",
              title: "Zgłoszenie zostało zamknięte",
              body: "Administrator zakończył obsługę problemu z zamówieniem.",
              href: `/zamowienia?order=${order.data.id}`,
            },
            {
              user_id: order.data.seller_id,
              kind: "system",
              title: "Zgłoszenie zostało zamknięte",
              body: "Administrator zakończył obsługę problemu z zamówieniem.",
              href: `/zamowienia?order=${order.data.id}`,
            },
          ]);
          await recordAudit(user.id, "close_problem", "order", order.data.id);
          return Response.json({ ok: true });
        }

        if (
          order.data.payment_status !== "paid" ||
          !["shipped", "delivered", "cancelled"].includes(order.data.status)
        )
          return Response.json({ error: "Tego zamówienia nie można zwrócić." }, { status: 409 });
        try {
          const config = paymentConfig(process.env);
          if (order.data.stripe_livemode !== config.liveMode)
            return Response.json(
              { error: "Zamówienie pochodzi z innego trybu Stripe." },
              { status: 409 },
            );
          if (order.data.status !== "cancelled") {
            const { data: claimed, error: claimError } = await db
              .from("orders")
              .update({ status: "cancelled" })
              .eq("id", order.data.id)
              .eq("status", order.data.status)
              .eq("payment_status", "paid")
              .select("id")
              .maybeSingle();
            if (claimError || !claimed)
              return Response.json(
                { error: "Status zamówienia zmienił się. Odśwież panel." },
                { status: 409 },
              );
          }
          const stripe = new Stripe(config.key);
          const transfers = await stripe.transfers.list({
            transfer_group: `order_${order.data.id}`,
            limit: 10,
          });
          for (const transfer of transfers.data.filter((item) => !item.reversed))
            await stripe.transfers.createReversal(
              transfer.id,
              {
                amount: transfer.amount - transfer.amount_reversed,
                metadata: { order_id: order.data.id },
              },
              { idempotencyKey: `klockownia-reversal:${order.data.id}:${transfer.id}:v1` },
            );
          const refund = await refundPayment(stripe, order.data, config.liveMode);
          if (refund.status !== "succeeded")
            return Response.json(
              { error: "Zwrot Stripe nadal jest przetwarzany." },
              { status: 409 },
            );
          await db.from("listings").update({ status: "active" }).eq("id", order.data.listing_id);
          const updated = await db
            .from("orders")
            .update({ status: "cancelled", payment_status: "refunded" })
            .eq("id", order.data.id)
            .eq("payment_status", "paid");
          if (updated.error) throw updated.error;
          await db.from("order_events").insert({
            order_id: order.data.id,
            actor_id: user.id,
            event_type: "payment_refunded",
            payload: { stripe_refund_id: refund.id, resolved_by: "admin" },
          });
          await db.from("notifications").insert([
            {
              user_id: order.data.buyer_id,
              kind: "payment",
              title: "Płatność została zwrócona",
              body: "Administrator zatwierdził pełny zwrot płatności.",
              href: `/zamowienia?order=${order.data.id}`,
            },
            {
              user_id: order.data.seller_id,
              kind: "payment",
              title: "Zamówienie zostało zwrócone",
              body: "Administrator zatwierdził zwrot; transfer został cofnięty.",
              href: `/zamowienia?order=${order.data.id}`,
            },
          ]);
          await recordAudit(user.id, "refund_order", "order", order.data.id, {
            stripe_refund_id: refund.id,
          });
          return Response.json({ ok: true });
        } catch {
          console.error("Admin refund requires investigation", order.data.id);
          return Response.json({ error: "Nie udało się zakończyć zwrotu." }, { status: 503 });
        }
      },
    },
  },
});
