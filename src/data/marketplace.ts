import { useEffect, useState } from "react";
import fallbackImage from "@/assets/set-bulk.jpg";
import type { Listing } from "@/data/listings";
import { requireSupabase, supabase } from "@/lib/supabase";
import { authenticatedRequest } from "@/lib/authenticated-request";

type ListingRow = {
  id: string;
  seller_id: string;
  title: string;
  theme: string;
  price_grosz: number;
  condition: string;
  pieces: number | null;
  production_year: number | null;
  is_complete: boolean;
  has_instructions: boolean;
  has_box: boolean;
  promoted_until: string | null;
  description: string;
  set_number: string | null;
  created_at: string;
  listing_images?: { storage_path: string; position: number }[];
  profiles?:
    | { username: string; city: string | null; vacation_mode?: boolean }
    | { username: string; city: string | null; vacation_mode?: boolean }[]
    | null;
};

function toListing(row: ListingRow): Listing {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  const images = [...(row.listing_images ?? [])]
    .sort((a, b) => a.position - b.position)
    .map(
      (picture) =>
        requireSupabase().storage.from("listing-images").getPublicUrl(picture.storage_path).data
          .publicUrl,
    );
  const image = images[0] ?? fallbackImage;
  return {
    id: row.id,
    title: row.title,
    setNumber: row.set_number ?? "—",
    theme: row.theme,
    price: row.price_grosz / 100,
    condition: row.condition as Listing["condition"],
    pieces: row.pieces ?? 0,
    year: row.production_year ?? new Date().getFullYear(),
    complete: row.is_complete,
    instructions: row.has_instructions,
    box: row.has_box,
    image,
    images,
    city: profile?.city ?? "Polska",
    seller: {
      id: row.seller_id,
      name: profile?.username ?? "Kolekcjoner",
      rating: 0,
      sales: 0,
      away: Boolean(profile?.vacation_mode),
    },
    description: row.description,
    promoted: Boolean(row.promoted_until && new Date(row.promoted_until) > new Date()),
  };
}

export async function loadPublicListings() {
  const { data, error } = await requireSupabase()
    .from("listings")
    .select(
      "id,seller_id,title,theme,price_grosz,condition,pieces,production_year,is_complete,has_instructions,has_box,promoted_until,description,set_number,created_at,listing_images(storage_path,position),profiles!listings_seller_id_fkey(username,city,vacation_mode)",
    )
    .eq("status", "active")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as ListingRow[]).map(toListing);
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Loads a marketplace offer created in Supabase. Fixture URLs continue to work during the transition. */
export async function loadListing(id: string) {
  if (!uuidPattern.test(id)) return null;
  const { data, error } = await requireSupabase()
    .from("listings")
    .select(
      "id,seller_id,title,theme,price_grosz,condition,pieces,production_year,is_complete,has_instructions,has_box,promoted_until,description,set_number,created_at,listing_images(storage_path,position),profiles!listings_seller_id_fkey(username,city,vacation_mode)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? toListing(data as ListingRow) : null;
}

export function useListing(id: string) {
  const [item, setItem] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase && uuidPattern.test(id)));
  useEffect(() => {
    if (!supabase || !uuidPattern.test(id)) return;
    void loadListing(id)
      .then(setItem)
      .finally(() => setLoading(false));
  }, [id]);
  return { item, loading };
}

export function usePublicListings() {
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState<string | null>(null);
  const reload = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      setItems(await loadPublicListings());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nie udało się pobrać ofert.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void reload();
  }, []);
  return { items, loading, error, reload };
}

export type PublicSellerProfile = {
  name: string;
  bio: string;
  city: string | null;
  country: string;
  joined: string;
  rating: number | null;
  reviews: { id: string; rating: number; body: string; at: string }[];
};

async function loadPublicSellerProfile(name: string) {
  const { data, error } = await requireSupabase()
    .from("profiles")
    .select("id,username,bio,city,country,created_at")
    .eq("username", name)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { data: reviews, error: reviewsError } = await requireSupabase()
    .from("reviews")
    .select("id,rating,body,created_at")
    .eq("seller_id", data.id)
    .order("created_at", { ascending: false })
    .limit(12);
  if (reviewsError) throw reviewsError;
  const mappedReviews = (reviews ?? []).map((review) => ({
    id: review.id,
    rating: review.rating,
    body: review.body ?? "",
    at: new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium" }).format(
      new Date(review.created_at),
    ),
  }));
  return {
    name: data.username,
    bio: data.bio ?? "",
    city: data.city,
    country: data.country,
    joined: new Intl.DateTimeFormat("pl-PL", { month: "long", year: "numeric" }).format(
      new Date(data.created_at),
    ),
    rating: mappedReviews.length
      ? mappedReviews.reduce((sum, review) => sum + review.rating, 0) / mappedReviews.length
      : null,
    reviews: mappedReviews,
  } satisfies PublicSellerProfile;
}

export function usePublicSellerProfile(name: string) {
  const [profile, setProfile] = useState<PublicSellerProfile | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  useEffect(() => {
    if (!supabase) return;
    void loadPublicSellerProfile(name)
      .then(setProfile)
      .finally(() => setLoading(false));
  }, [name]);
  return { profile, loading };
}

export function useFavoriteListings() {
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!supabase) return;
    void (async () => {
      const { data: auth } = await requireSupabase().auth.getUser();
      if (!auth.user) return;
      const { data, error: queryError } = await requireSupabase()
        .from("favorites")
        .select(
          "listing_id,listings!inner(id,seller_id,title,theme,price_grosz,condition,pieces,production_year,is_complete,has_instructions,has_box,promoted_until,description,set_number,created_at,listing_images(storage_path,position),profiles!listings_seller_id_fkey(username,city))",
        )
        .eq("user_id", auth.user.id)
        .eq("listings.status", "active");
      if (queryError) throw queryError;
      setItems(
        (data ?? []).flatMap((row: any) =>
          row.listings ? [toListing(row.listings as ListingRow)] : [],
        ),
      );
    })()
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : "Nie udało się pobrać ulubionych."),
      )
      .finally(() => setLoading(false));
  }, []);
  return { items, loading, error };
}

export type CreateListingInput = {
  title: string;
  description: string;
  category: string;
  theme: string;
  condition: string;
  price: number;
  setNumber: string;
  pieces: number | null;
  year: number | null;
  hasInstructions: boolean;
  hasBox: boolean;
  photos: File[];
};

export type ManagedListing = {
  id: string;
  title: string;
  description: string;
  setNumber: string;
  pieces: number | null;
  year: number | null;
  theme: string;
  price: number;
  condition: string;
  image: string;
  status: "active" | "hidden" | "draft";
  promoted: boolean;
  views: number;
};

async function loadMyListings() {
  const client = requireSupabase();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return [] as ManagedListing[];
  const { data, error } = await client
    .from("listings")
    .select(
      "id,title,description,set_number,pieces,production_year,theme,price_grosz,condition,status,promoted_until,listing_images(storage_path,position)",
    )
    .eq("seller_id", auth.user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((listing: any) => {
    const picture = [...(listing.listing_images ?? [])].sort(
      (a: any, b: any) => a.position - b.position,
    )[0];
    return {
      id: listing.id,
      title: listing.title,
      description: listing.description ?? "",
      setNumber: listing.set_number ?? "",
      pieces: listing.pieces,
      year: listing.production_year,
      theme: listing.theme,
      price: listing.price_grosz / 100,
      condition: listing.condition,
      image: picture
        ? requireSupabase().storage.from("listing-images").getPublicUrl(picture.storage_path).data
            .publicUrl
        : fallbackImage,
      status: listing.status,
      promoted: Boolean(listing.promoted_until && new Date(listing.promoted_until) > new Date()),
      views: 0,
    } satisfies ManagedListing;
  });
}

export function useMyListings() {
  const [items, setItems] = useState<ManagedListing[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = async () => {
    try {
      setItems(await loadMyListings());
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void reload();
  }, []);
  return { items, loading, reload };
}

export async function updateListingStatus(id: string, status: ManagedListing["status"]) {
  const { error } = await requireSupabase().from("listings").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function updateListingDetails(
  id: string,
  input: {
    title: string;
    price: number;
    description: string;
    condition: string;
    setNumber: string;
    pieces: number | null;
    year: number | null;
  },
) {
  const title = input.title.trim();
  const description = input.description.trim();
  if (title.length < 3 || title.length > 80) throw new Error("Tytuł musi mieć od 3 do 80 znaków.");
  if (!(input.price > 0)) throw new Error("Cena musi być większa od zera.");
  if (description.length > 1500) throw new Error("Opis może mieć maksymalnie 1500 znaków.");
  if (!input.condition.trim()) throw new Error("Wybierz stan zestawu.");
  if (input.pieces !== null && (!Number.isInteger(input.pieces) || input.pieces < 0))
    throw new Error("Liczba elementów musi być liczbą całkowitą.");
  if (
    input.year !== null &&
    (!Number.isInteger(input.year) ||
      input.year < 1949 ||
      input.year > new Date().getFullYear() + 1)
  )
    throw new Error("Podaj poprawny rok wydania.");
  const { error } = await requireSupabase()
    .from("listings")
    .update({
      title,
      description,
      condition: input.condition.trim(),
      set_number: input.setNumber.trim() || null,
      pieces: input.pieces,
      production_year: input.year,
      price_grosz: Math.round(input.price * 100),
    })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteListing(id: string) {
  const client = requireSupabase();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) throw new Error("Zaloguj się, aby usunąć ogłoszenie.");
  const { data: images, error: imageError } = await client
    .from("listing_images")
    .select("storage_path")
    .eq("listing_id", id);
  if (imageError) throw imageError;
  const paths = (images ?? []).map((image) => image.storage_path);
  if (paths.length) {
    const { error: storageError } = await client.storage.from("listing-images").remove(paths);
    if (storageError) throw storageError;
  }
  const { error } = await client
    .from("listings")
    .delete()
    .eq("id", id)
    .eq("seller_id", auth.user.id);
  if (error) throw error;
}

export async function createListing(input: CreateListingInput) {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) throw new Error("Zaloguj się, aby opublikować ofertę.");
  if (input.title.trim().length < 3 || input.title.trim().length > 80)
    throw new Error("Tytuł musi mieć od 3 do 80 znaków.");
  if (!(input.price > 0)) throw new Error("Podaj cenę większą od zera.");
  if (input.pieces !== null && (!Number.isInteger(input.pieces) || input.pieces < 0))
    throw new Error("Liczba elementów musi być liczbą całkowitą.");
  if (
    input.year !== null &&
    (!Number.isInteger(input.year) ||
      input.year < 1949 ||
      input.year > new Date().getFullYear() + 1)
  )
    throw new Error("Podaj poprawny rok wydania.");
  if (!input.photos.length) throw new Error("Dodaj przynajmniej jedno zdjęcie oferty.");
  if (input.photos.length > 20) throw new Error("Możesz dodać maksymalnie 20 zdjęć.");
  if (input.photos.some((photo) => !["image/jpeg", "image/png", "image/webp"].includes(photo.type)))
    throw new Error("Dodaj zdjęcia w formacie JPG, PNG lub WebP.");
  if (input.photos.some((photo) => photo.size > 10 * 1024 * 1024))
    throw new Error("Pojedyncze zdjęcie może mieć maksymalnie 10 MB.");
  const { data: listing, error } = await client
    .from("listings")
    .insert({
      seller_id: auth.user.id,
      title: input.title.trim(),
      description: input.description.trim(),
      category: input.category,
      theme: input.theme,
      condition: input.condition,
      price_grosz: Math.round(input.price * 100),
      set_number: input.setNumber.trim() || null,
      pieces: input.pieces,
      production_year: input.year,
      has_instructions: input.hasInstructions,
      has_box: input.hasBox,
      seller_is_private: true,
      status: "draft",
    })
    .select("id")
    .single();
  if (error || !listing) throw error ?? new Error("Nie udało się zapisać oferty.");
  const uploadedPaths: string[] = [];
  try {
    for (const [position, photo] of input.photos.entries()) {
      const extension = photo.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${auth.user.id}/${listing.id}/${position}.${extension}`;
      const { error: uploadError } = await client.storage
        .from("listing-images")
        .upload(path, photo, { upsert: false });
      if (uploadError) throw uploadError;
      uploadedPaths.push(path);
      const { error: imageError } = await client
        .from("listing_images")
        .insert({ listing_id: listing.id, storage_path: path, position });
      if (imageError) throw imageError;
    }
    const { error: activateError } = await client
      .from("listings")
      .update({ status: "active" })
      .eq("id", listing.id)
      .eq("seller_id", auth.user.id)
      .eq("status", "draft");
    if (activateError) throw activateError;
  } catch (cause) {
    if (uploadedPaths.length) await client.storage.from("listing-images").remove(uploadedPaths);
    await client.from("listings").delete().eq("id", listing.id).eq("seller_id", auth.user.id);
    throw cause;
  }
  return listing.id as string;
}

export type CheckoutInput = {
  listingId: string;
  acceptedOfferId?: string;
  lockerId: string;
  carrier: "inpost" | "orlen" | "dpd" | "dhl";
  receiver: { email: string; phone: string; firstName: string; lastName: string };
};

export async function startCheckout(input: CheckoutInput) {
  const client = requireSupabase();
  const response = await authenticatedRequest(client, "/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const result = (await response.json()) as { checkoutUrl?: string; error?: string };
  if (!response.ok || !result.checkoutUrl)
    throw new Error(result.error ?? "Nie udało się rozpocząć płatności.");
  window.location.assign(result.checkoutUrl);
}

export type MarketplaceOrder = {
  id: string;
  kind: "bought" | "sold";
  title: string;
  image: string;
  price: number;
  total: number;
  counterparty: string;
  status:
    | "W oczekiwaniu na płatność"
    | "Opłacone"
    | "Wysłane"
    | "Dostarczone"
    | "Anulowane"
    | "Zwrot w toku"
    | "Zwrócone";
  carrier: string;
  carrierCode: "inpost" | "orlen" | "dpd" | "dhl";
  pickupPoint: string;
  trackingNumber: string | null;
  at: string;
};

const orderStatusLabels: Record<string, MarketplaceOrder["status"]> = {
  pending_payment: "W oczekiwaniu na płatność",
  paid: "Opłacone",
  shipped: "Wysłane",
  delivered: "Dostarczone",
  cancelled: "Anulowane",
  refunded: "Zwrócone",
};

async function loadOrders() {
  const client = requireSupabase();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return [] as MarketplaceOrder[];
  const response = await authenticatedRequest(client, "/api/orders", { method: "GET" });
  const result = (await response.json()) as any[] | { error?: string };
  if (!response.ok || !Array.isArray(result))
    throw new Error(Array.isArray(result) ? "Nie udało się pobrać zamówień." : result.error);
  const data = result;
  return (data ?? []).map((order: any) => {
    const listing = order.listings;
    const picture = [...(listing?.listing_images ?? [])].sort(
      (a: any, b: any) => a.position - b.position,
    )[0];
    const kind = order.buyer_id === auth.user!.id ? "bought" : "sold";
    const carrierCode = ["inpost", "orlen", "dpd", "dhl"].includes(order.shipping_carrier)
      ? order.shipping_carrier
      : "inpost";
    return {
      id: order.id,
      kind,
      title: listing?.title ?? "Usunięta oferta",
      image: picture
        ? requireSupabase().storage.from("listing-images").getPublicUrl(picture.storage_path).data
            .publicUrl
        : fallbackImage,
      price: order.amount_grosz / 100,
      total: order.amount_grosz / 100,
      counterparty:
        kind === "bought"
          ? (order.seller?.username ?? "Sprzedawca")
          : (order.buyer?.username ?? "Kupujący"),
      status:
        order.payment_status === "refunded"
          ? "Zwrócone"
          : order.status === "cancelled" && order.payment_status === "paid"
            ? "Zwrot w toku"
            : (orderStatusLabels[order.status] ?? "W oczekiwaniu na płatność"),
      carrier:
        (
          { inpost: "InPost", orlen: "ORLEN Paczka", dpd: "DPD Pickup", dhl: "DHL POP" } as Record<
            string,
            string
          >
        )[order.shipping_carrier] ?? "Dostawa",
      carrierCode: carrierCode as MarketplaceOrder["carrierCode"],
      pickupPoint: order.locker_id,
      trackingNumber: order.tracking_number ?? null,
      at: new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium" }).format(
        new Date(order.created_at),
      ),
    } satisfies MarketplaceOrder;
  });
}

export function useOrders() {
  const [items, setItems] = useState<MarketplaceOrder[]>([]);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!supabase) return;
    void loadOrders()
      .then(setItems)
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : "Nie udało się pobrać zamówień."),
      )
      .finally(() => setLoading(false));
  }, [revision]);
  return { items, loading, error, reload: () => setRevision((value) => value + 1) };
}

export type MarketplaceOrderEvent = {
  id: number;
  orderId: string;
  type: string;
  label: string;
  at: string;
};

const orderEventLabels: Record<string, string> = {
  checkout_started: "Rozpoczęto płatność",
  payment_confirmed: "Płatność potwierdzona",
  shipment_marked_shipped: "Przesyłka została nadana",
  delivery_confirmed: "Odbiór został potwierdzony",
  payment_refunded: "Płatność została zwrócona",
  problem_reported: "Kupujący zgłosił problem",
  problem_resolved: "Problem został rozwiązany",
  review_created: "Dodano opinię po zakupie",
};

async function loadOrderEvents(orderIds: string[]) {
  if (orderIds.length === 0) return [] as MarketplaceOrderEvent[];
  const { data, error } = await requireSupabase()
    .from("order_events")
    .select("id,order_id,event_type,created_at")
    .in("order_id", orderIds)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((event: any) => ({
    id: event.id,
    orderId: event.order_id,
    type: event.event_type,
    label: orderEventLabels[event.event_type] ?? "Aktualizacja zamówienia",
    at: new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(event.created_at),
    ),
  }));
}

export function useOrderEvents(orderIds: string[]) {
  const [items, setItems] = useState<MarketplaceOrderEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const key = orderIds.join(",");
  useEffect(() => {
    if (!supabase) return;
    void loadOrderEvents(orderIds)
      .then(setItems)
      .catch((cause) =>
        setError(
          cause instanceof Error ? cause.message : "Nie udało się pobrać historii zamówienia.",
        ),
      );
  }, [key, revision]);
  return { items, error, reload: () => setRevision((value) => value + 1) };
}

export async function markOrderShipped(orderId: string, trackingNumber: string) {
  const client = requireSupabase();
  const { data } = await client.auth.getSession();
  if (!data.session?.access_token) throw new Error("Zaloguj się, aby nadać przesyłkę.");
  const response = await fetch("/api/orders", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.session.access_token}`,
    },
    body: JSON.stringify({ orderId, action: "mark_shipped", trackingNumber }),
  });
  const result = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(result.error ?? "Nie udało się zapisać nadania.");
}

export async function confirmOrderDelivered(orderId: string) {
  const client = requireSupabase();
  const { data } = await client.auth.getSession();
  if (!data.session?.access_token) throw new Error("Zaloguj się, aby potwierdzić odbiór.");
  const response = await fetch("/api/orders", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.session.access_token}`,
    },
    body: JSON.stringify({ orderId, action: "confirm_delivered" }),
  });
  const result = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(result.error ?? "Nie udało się potwierdzić odbioru.");
}

export async function cancelOrderBeforeShipment(orderId: string) {
  const client = requireSupabase();
  const { data } = await client.auth.getSession();
  if (!data.session?.access_token) throw new Error("Zaloguj się, aby anulować zamówienie.");
  const response = await fetch("/api/orders", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.session.access_token}`,
    },
    body: JSON.stringify({ orderId, action: "cancel_before_shipment" }),
  });
  const result = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(result.error ?? "Nie udało się anulować zamówienia.");
}

export async function updateOrderProblem(
  orderId: string,
  input:
    | {
        action: "report_problem";
        reason: "damaged" | "incomplete" | "not_as_described" | "not_received" | "other";
        details: string;
      }
    | { action: "resolve_problem" },
) {
  const client = requireSupabase();
  const { data } = await client.auth.getSession();
  if (!data.session?.access_token) throw new Error("Zaloguj się, aby zarządzać zgłoszeniem.");
  const response = await fetch("/api/orders", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.session.access_token}`,
    },
    body: JSON.stringify({ orderId, ...input }),
  });
  const result = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(result.error ?? "Nie udało się zapisać zgłoszenia.");
}

export async function startOrderConversation(orderId: string) {
  const client = requireSupabase();
  const { data } = await client.auth.getSession();
  if (!data.session?.access_token) throw new Error("Zaloguj się, aby otworzyć rozmowę.");
  const response = await fetch("/api/orders", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.session.access_token}`,
    },
    body: JSON.stringify({ orderId, action: "start_conversation" }),
  });
  const result = (await response.json()) as { conversationId?: string; error?: string };
  if (!response.ok || !result.conversationId)
    throw new Error(result.error ?? "Nie udało się otworzyć rozmowy.");
  return result.conversationId;
}

export async function submitReview(orderId: string, rating: number, body: string) {
  const client = requireSupabase();
  const { data } = await client.auth.getSession();
  if (!data.session?.access_token) throw new Error("Zaloguj się, aby wystawić opinię.");
  const response = await fetch("/api/reviews", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.session.access_token}`,
    },
    body: JSON.stringify({ orderId, rating, body }),
  });
  const result = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(result.error ?? "Nie udało się zapisać opinii.");
}

export async function reportListing(
  listingId: string,
  reason: "misleading" | "counterfeit" | "prohibited" | "spam" | "other",
  details: string,
) {
  const client = requireSupabase();
  const { data } = await client.auth.getSession();
  if (!data.session?.access_token) throw new Error("Zaloguj się, aby zgłosić ofertę.");
  const response = await fetch("/api/reports", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.session.access_token}`,
    },
    body: JSON.stringify({ listingId, reason, details }),
  });
  const result = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(result.error ?? "Nie udało się wysłać zgłoszenia.");
}
