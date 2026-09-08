import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getSupabaseAdmin, hasSupabaseAdminConfig } from "@/server/supabase-admin";

const reviewInput = z.object({ orderId: z.string().uuid(), rating: z.number().int().min(1).max(5), body: z.string().trim().max(500) });

export const Route = createFileRoute("/api/reviews")({
  server: { handlers: { POST: async ({ request }) => {
    if (!hasSupabaseAdminConfig()) return Response.json({ error: "Opinie nie są jeszcze skonfigurowane." }, { status: 503 });
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return Response.json({ error: "Zaloguj się, aby wystawić opinię." }, { status: 401 });
    const admin = getSupabaseAdmin();
    const { data: user, error: userError } = await admin.auth.getUser(token);
    if (userError || !user.user) return Response.json({ error: "Sesja wygasła." }, { status: 401 });
    const parsed = reviewInput.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Ocena musi mieć od 1 do 5 gwiazdek." }, { status: 400 });
    const { data: order } = await admin.from("orders").select("id,buyer_id,seller_id,status").eq("id", parsed.data.orderId).maybeSingle();
    if (!order || order.buyer_id !== user.user.id || order.status !== "delivered") return Response.json({ error: "Opinię można wystawić po potwierdzonym odbiorze." }, { status: 409 });
    const { error } = await admin.from("reviews").insert({ order_id: order.id, reviewer_id: user.user.id, seller_id: order.seller_id, rating: parsed.data.rating, body: parsed.data.body || null });
    if (error) return Response.json({ error: error.code === "23505" ? "Opinia do tego zamówienia już istnieje." : "Nie udało się zapisać opinii." }, { status: 409 });
    await admin.from("order_events").insert({ order_id: order.id, actor_id: user.user.id, event_type: "review_created", payload: { rating: parsed.data.rating } });
    return Response.json({ ok: true });
  } } },
});
