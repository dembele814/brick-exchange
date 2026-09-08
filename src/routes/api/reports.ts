import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getSupabaseAdmin, hasSupabaseAdminConfig } from "@/server/supabase-admin";

const input = z.object({ listingId: z.string().uuid(), reason: z.enum(["misleading", "counterfeit", "prohibited", "spam", "other"]), details: z.string().trim().max(1000) });

export const Route = createFileRoute("/api/reports")({
  server: { handlers: { POST: async ({ request }) => {
    if (!hasSupabaseAdminConfig()) return Response.json({ error: "Zgłoszenia nie są jeszcze skonfigurowane." }, { status: 503 });
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return Response.json({ error: "Zaloguj się, aby zgłosić ofertę." }, { status: 401 });
    const admin = getSupabaseAdmin();
    const { data: user, error: userError } = await admin.auth.getUser(token);
    if (userError || !user.user) return Response.json({ error: "Sesja wygasła." }, { status: 401 });
    const parsed = input.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Uzupełnij poprawnie zgłoszenie." }, { status: 400 });
    const { data: listing } = await admin.from("listings").select("id,seller_id").eq("id", parsed.data.listingId).maybeSingle();
    if (!listing || listing.seller_id === user.user.id) return Response.json({ error: "Nie możesz zgłosić tej oferty." }, { status: 409 });
    const { error } = await admin.from("listing_reports").insert({ listing_id: listing.id, reporter_id: user.user.id, reason: parsed.data.reason, details: parsed.data.details || null });
    if (error) return Response.json({ error: error.code === "23505" ? "Ta oferta została już przez Ciebie zgłoszona." : "Nie udało się zapisać zgłoszenia." }, { status: 409 });
    return Response.json({ ok: true });
  } } },
});
