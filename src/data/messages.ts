import { useEffect, useId, useState } from "react";
import { useAccount } from "@/data/account";
import fallbackImage from "@/assets/set-bulk.jpg";
import { requireSupabase, supabase } from "@/lib/supabase";

export type Message = {
  id: string;
  from: "me" | "them";
  text: string;
  at: number;
  type: "text" | "image" | "price_offer";
  imageUrl?: string | undefined;
  offerAmount?: number | undefined;
  offerStatus?: "pending" | "accepted" | "rejected" | undefined;
};
export type ConversationOrder = {
  id: string;
  status: "paid" | "shipped" | "delivered" | "cancelled" | "refunded";
  amount: number;
  createdAt: number;
  updatedAt: number;
  labelReady: boolean;
  shipmentCreated: boolean;
  shipmentNeedsPurchase: boolean;
};
export type Conversation = {
  id: string;
  sellerName: string;
  listingId: string;
  listingTitle: string;
  listingImage: string;
  listingPrice: number;
  canMakeOffer: boolean;
  isBuyer: boolean;
  order?: ConversationOrder;
  messages: Message[];
  unread: number;
};

type ListingImageRow = { storage_path: string; position: number };
type ConversationRow = {
  id: string;
  listing_id: string;
  buyer_id: string;
  listings: {
    title: string;
    price_grosz: number;
    status: string;
    listing_images: ListingImageRow[];
  } | null;
};
type ParticipantRow = {
  conversation_id: string;
  user_id: string;
  profiles: { username?: string } | { username?: string }[] | null;
};
type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  message_type: Message["type"];
  image_path: string | null;
  offer_amount_grosz: number | null;
  offer_status: Message["offerStatus"] | null;
};
type OrderRow = {
  id: string;
  listing_id: string;
  buyer_id: string;
  amount_grosz: number;
  status: ConversationOrder["status"];
  payment_status: string;
  created_at: string;
  carrier_shipment_id: string | null;
  carrier_order_command_id: string | null;
  shipping_label_ready_at: string | null;
};

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
const imageFor = (path?: string) =>
  path
    ? requireSupabase().storage.from("listing-images").getPublicUrl(path).data.publicUrl
    : fallbackImage;

async function load() {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) return [] as Conversation[];
  const { data: mine, error: mineError } = await client
    .from("conversation_participants")
    .select("conversation_id,last_read_at")
    .eq("user_id", auth.user.id);
  if (mineError) throw mineError;
  const ids = (mine ?? []).map((participant) => participant.conversation_id);
  if (!ids.length) return [] as Conversation[];
  const [conversationsResult, participantsResult, messagesResult, ordersResult] = await Promise.all(
    [
      client
        .from("conversations")
        .select(
          "id,listing_id,buyer_id,listings(title,price_grosz,status,listing_images(storage_path,position))",
        )
        .in("id", ids),
      client
        .from("conversation_participants")
        .select("conversation_id,user_id,profiles!conversation_participants_user_id_fkey(username)")
        .in("conversation_id", ids),
      client
        .from("messages")
        .select(
          "id,conversation_id,sender_id,body,created_at,message_type,image_path,offer_amount_grosz,offer_status",
        )
        .in("conversation_id", ids)
        .order("created_at"),
      client
        .from("orders")
        .select(
          "id,listing_id,buyer_id,amount_grosz,status,payment_status,created_at,updated_at,carrier_shipment_id,carrier_order_command_id,shipping_label_ready_at",
        )
        .neq("payment_status", "pending")
        .order("created_at", { ascending: false }),
    ],
  );
  if (
    conversationsResult.error ||
    participantsResult.error ||
    messagesResult.error ||
    ordersResult.error
  )
    throw (
      conversationsResult.error ??
      participantsResult.error ??
      messagesResult.error ??
      ordersResult.error
    );
  const conversationRows = (conversationsResult.data ?? []) as ConversationRow[];
  const participantRows = (participantsResult.data ?? []) as ParticipantRow[];
  const messageRows = (messagesResult.data ?? []) as MessageRow[];
  const orderRows = (ordersResult.data ?? []) as OrderRow[];
  const imagePaths = messageRows
    .map((message) => message.image_path)
    .filter((path): path is string => Boolean(path));
  const signedImages = new Map<string, string>();
  if (imagePaths.length) {
    const signed = await client.storage.from("message-images").createSignedUrls(imagePaths, 3600);
    if (signed.error) throw signed.error;
    signed.data.forEach((item) => {
      if (item.path && item.signedUrl) signedImages.set(item.path, item.signedUrl);
    });
  }
  const readAt = new Map(
    (mine ?? []).map((participant) => [
      participant.conversation_id,
      participant.last_read_at ? Date.parse(participant.last_read_at) : 0,
    ]),
  );
  return conversationRows
    .map((conversation) => {
      const listing = conversation.listings;
      const picture = [...(listing?.listing_images ?? [])].sort(
        (a, b) => a.position - b.position,
      )[0];
      const other = participantRows.find(
        (participant) =>
          participant.conversation_id === conversation.id && participant.user_id !== auth.user!.id,
      );
      const otherProfile = Array.isArray(other?.profiles) ? other.profiles[0] : other?.profiles;
      const messages = messageRows.filter((message) => message.conversation_id === conversation.id);
      const order = orderRows.find(
        (candidate) =>
          candidate.listing_id === conversation.listing_id &&
          candidate.buyer_id === conversation.buyer_id,
      );
      return {
        id: conversation.id,
        listingId: conversation.listing_id,
        listingTitle: listing?.title ?? "Oferta",
        listingImage: imageFor(picture?.storage_path),
        listingPrice: (listing?.price_grosz ?? 0) / 100,
        canMakeOffer: listing?.status === "active",
        isBuyer: conversation.buyer_id === auth.user!.id,
        sellerName: otherProfile?.username ?? "Kolekcjoner",
        order: order
          ? {
              id: order.id,
              status:
                order.payment_status === "refunded"
                  ? "refunded"
                  : order.status === "cancelled"
                    ? "cancelled"
                    : order.status,
              amount: order.amount_grosz / 100,
              createdAt: Date.parse(order.created_at),
              updatedAt: Date.parse(order.updated_at),
              labelReady: Boolean(order.shipping_label_ready_at && order.carrier_shipment_id),
              shipmentCreated: Boolean(order.carrier_shipment_id),
              shipmentNeedsPurchase: Boolean(
                order.carrier_shipment_id && !order.carrier_order_command_id,
              ),
            }
          : undefined,
        messages: messages.map((message) => ({
          id: message.id,
          from: message.sender_id === auth.user!.id ? "me" : "them",
          text: message.body,
          at: Date.parse(message.created_at),
          type: message.message_type ?? "text",
          imageUrl: message.image_path ? signedImages.get(message.image_path) : undefined,
          offerAmount: message.offer_amount_grosz ? message.offer_amount_grosz / 100 : undefined,
          offerStatus: message.offer_status ?? undefined,
        })),
        unread: messages.filter(
          (message) =>
            message.sender_id !== auth.user!.id &&
            Date.parse(message.created_at) > (readAt.get(conversation.id) ?? 0),
        ).length,
      } satisfies Conversation;
    })
    .sort(
      (a, b) =>
        Math.max(b.messages.at(-1)?.at ?? 0, b.order?.updatedAt ?? 0) -
        Math.max(a.messages.at(-1)?.at ?? 0, a.order?.updatedAt ?? 0),
    );
}

export function useConversations() {
  const { loggedIn, authLoading } = useAccount();
  const channelId = useId();
  const [state, setState] = useState<Conversation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (authLoading || !loggedIn || !supabase) {
      setState([]);
      setError(null);
      setLoading(authLoading);
      return;
    }
    const client = supabase;
    let disposed = false;
    let revision = 0;
    const reload = () => {
      const requestRevision = ++revision;
      setLoading(true);
      void load()
        .then((items) => {
          if (disposed || requestRevision !== revision) return;
          setState(items);
          setError(null);
        })
        .catch(() => {
          if (!disposed && requestRevision === revision)
            setError("Nie udało się wczytać rozmów. Sprawdź połączenie i spróbuj ponownie.");
        })
        .finally(() => {
          if (!disposed && requestRevision === revision) setLoading(false);
        });
    };
    listeners.add(reload);
    reload();
    let reloadTimer: ReturnType<typeof setTimeout> | undefined;
    const queueReload = () => {
      if (reloadTimer) clearTimeout(reloadTimer);
      reloadTimer = setTimeout(reload, 180);
    };
    const channel = client
      .channel(`marketplace-inbox:${channelId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, queueReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, queueReload)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversation_participants" },
        queueReload,
      )
      .subscribe();
    return () => {
      disposed = true;
      listeners.delete(reload);
      if (reloadTimer) clearTimeout(reloadTimer);
      void client.removeChannel(channel);
    };
  }, [loggedIn, authLoading, channelId]);
  return { conversations: state, error, loading, reload: notify };
}

export function useUnreadCount() {
  return useConversations().conversations.reduce(
    (total, conversation) => total + conversation.unread,
    0,
  );
}

export async function markRead(conversationId: string) {
  const client = requireSupabase();
  const { data } = await client.auth.getUser();
  if (!data.user) return;
  await client
    .from("conversation_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", data.user.id);
  notify();
}

export async function sendMessage(conversationId: string, text: string) {
  const client = requireSupabase();
  const { data } = await client.auth.getUser();
  if (!data.user) throw new Error("Zaloguj się, aby wysłać wiadomość.");
  const { error } = await client
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: data.user.id, body: text });
  if (error) throw error;
  notify();
}

export async function sendMessageImage(conversationId: string, file: File) {
  if (!file.type.match(/^image\/(jpeg|png|webp)$/) || file.size > 5 * 1024 * 1024)
    throw new Error("Wybierz zdjęcie JPG, PNG lub WebP do 5 MB.");
  const client = requireSupabase();
  const { data } = await client.auth.getUser();
  if (!data.user) throw new Error("Zaloguj się, aby wysłać zdjęcie.");
  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${conversationId}/${data.user.id}/${crypto.randomUUID()}.${extension}`;
  const upload = await client.storage.from("message-images").upload(path, file, { upsert: false });
  if (upload.error) throw upload.error;
  const inserted = await client.from("messages").insert({
    conversation_id: conversationId,
    sender_id: data.user.id,
    body: "Zdjęcie",
    message_type: "image",
    image_path: path,
  });
  if (inserted.error) {
    await client.storage.from("message-images").remove([path]);
    throw inserted.error;
  }
  notify();
}

export async function sendPriceOffer(conversationId: string, amount: number) {
  if (!Number.isFinite(amount) || amount < 1) throw new Error("Podaj prawidłową propozycję ceny.");
  const { error } = await requireSupabase().rpc("send_price_offer", {
    p_conversation_id: conversationId,
    p_amount_grosz: Math.round(amount * 100),
  });
  if (error) throw new Error("Propozycja musi być niższa od ceny oferty.");
  notify();
}

export async function respondToPriceOffer(messageId: string, accept: boolean) {
  const { error } = await requireSupabase().rpc("respond_to_price_offer", {
    p_message_id: messageId,
    p_accept: accept,
  });
  if (error) throw new Error("Nie udało się odpowiedzieć na propozycję.");
  notify();
}

export type AcceptedPriceOffer = { id: string; price: number };

export function useAcceptedOffer(listingId: string, preferredOfferId?: string) {
  const [offer, setOffer] = useState<AcceptedPriceOffer | null>(null);
  useEffect(() => {
    if (!supabase) {
      setOffer(null);
      return;
    }
    let disposed = false;
    void (async () => {
      const client = requireSupabase();
      const { data: auth } = await client.auth.getUser();
      if (!auth.user) return null;

      const findOffer = async (offerId?: string) => {
        let query = client
          .from("messages")
          .select("id,offer_amount_grosz,created_at,conversations!inner(listing_id,buyer_id)")
          .eq("message_type", "price_offer")
          .eq("offer_status", "accepted")
          .eq("conversations.listing_id", listingId)
          .eq("conversations.buyer_id", auth.user.id)
          .order("created_at", { ascending: false })
          .limit(1);
        if (offerId) query = query.eq("id", offerId);
        const { data, error } = await query.maybeSingle();
        if (error || !data?.offer_amount_grosz) return null;
        return { id: data.id, price: data.offer_amount_grosz / 100 };
      };

      // A link from the chat may identify an older accepted offer. Without that
      // link (for example after returning through the homepage), use the newest
      // accepted offer for this buyer and listing.
      return (preferredOfferId && (await findOffer(preferredOfferId))) || (await findOffer());
    })().then((value) => {
      if (!disposed) setOffer(value);
    });
    return () => {
      disposed = true;
    };
  }, [listingId, preferredOfferId]);
  return offer;
}

export async function startConversation(listingId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(listingId))
    throw new Error("To oferta demonstracyjna. Wybierz ofertę opublikowaną przez użytkownika.");
  const { data, error } = await requireSupabase().rpc("start_conversation", {
    p_listing_id: listingId,
  });
  if (error || !data)
    throw new Error(
      error?.code === "P0001"
        ? error.message
        : "Nie udało się rozpocząć rozmowy. Spróbuj ponownie za chwilę.",
    );
  notify();
  return data as string;
}

export function formatTime(at: number) {
  const diff = Math.round((Date.now() - at) / 60_000);
  if (diff < 1) return "teraz";
  if (diff < 60) return `${diff} min`;
  const hours = Math.round(diff / 60);
  if (hours < 24) return `${hours} godz.`;
  return `${Math.round(hours / 24)} dni`;
}
