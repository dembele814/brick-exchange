import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkoutInput, sessionParameters, type CheckoutOrder } from "./payments.ts";

export async function handleCheckout(
  request: Request,
  admin: SupabaseClient,
  stripe: Stripe,
  appUrl: string,
) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return Response.json({ error: "Zaloguj się, aby kupić ofertę." }, { status: 401 });
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (
    authError &&
    ((authError.status ?? 0) === 0 ||
      (authError.status ?? 0) >= 500 ||
      authError.name === "AuthRetryableFetchError" ||
      authError.name === "AuthUnknownError")
  ) {
    return Response.json(
      { error: "Nie można teraz połączyć się z usługą logowania. Spróbuj ponownie za chwilę." },
      { status: 503 },
    );
  }
  if (authError || !auth.user)
    return Response.json({ error: "Zaloguj się, aby kupić ofertę." }, { status: 401 });
  const parsed = checkoutInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ error: "Nieprawidłowe dane zamówienia." }, { status: 400 });
  const { data, error } = await admin.rpc("reserve_stripe_checkout", {
    p_buyer_id: auth.user.id,
    p_listing_id: parsed.data.listingId,
    p_carrier: parsed.data.carrier,
    p_locker_id: parsed.data.lockerId,
    p_receiver: parsed.data.receiver,
    p_origin: appUrl,
    p_offer_message_id: parsed.data.acceptedOfferId ?? null,
  });
  if (error) {
    if (error.code === "P0001" || error.code === "23505")
      return Response.json(
        {
          error:
            "Oferta jest niedostępna lub ma już rozpoczętą płatność. Ponów zakup z pierwotnymi danymi dostawy.",
        },
        { status: 409 },
      );
    throw new Error("Checkout reservation failed");
  }
  const order = data as CheckoutOrder;
  if (!order?.id) throw new Error("Missing checkout reservation");
  // Never release inventory merely because a Stripe request timed out.
  if (
    !order.stripe_checkout_session_id &&
    order.checkout_expires_at < Math.floor(Date.now() / 1000) + 1800
  )
    return Response.json(
      {
        error:
          "Sprawdzamy poprzednią próbę płatności. Spróbuj później lub skontaktuj się z obsługą.",
      },
      { status: 409 },
    );
  const session = order.stripe_checkout_session_id
    ? await stripe.checkout.sessions.retrieve(order.stripe_checkout_session_id)
    : await stripe.checkout.sessions.create(sessionParameters(order), {
        idempotencyKey: `checkout:${order.id}:v1`,
      });
  if (session.status !== "open" || !session.url || session.livemode)
    return Response.json(
      { error: "Ta płatność została już zakończona lub wygasła. Sprawdź zamówienia." },
      { status: 409 },
    );
  const { error: bindError } = await admin.rpc("bind_stripe_checkout", {
    p_order_id: order.id,
    p_session_id: session.id,
  });
  if (bindError) throw new Error("Checkout session persistence failed");
  return Response.json({ checkoutUrl: session.url });
}
