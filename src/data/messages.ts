import { useEffect, useId, useState } from "react";
import { useAccount } from "@/data/account";
import fallbackImage from "@/assets/set-bulk.jpg";
import { requireSupabase, supabase } from "@/lib/supabase";

export type Message = { id: string; from: "me" | "them"; text: string; at: number };
export type Conversation = {
  id: string;
  sellerName: string;
  listingId: string;
  listingTitle: string;
  listingImage: string;
  messages: Message[];
  unread: number;
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
  const [conversationsResult, participantsResult, messagesResult] = await Promise.all([
    client
      .from("conversations")
      .select("id,listing_id,listings(title,listing_images(storage_path,position))")
      .in("id", ids),
    client
      .from("conversation_participants")
      .select("conversation_id,user_id,profiles!conversation_participants_user_id_fkey(username)")
      .in("conversation_id", ids),
    client
      .from("messages")
      .select("id,conversation_id,sender_id,body,created_at")
      .in("conversation_id", ids)
      .order("created_at"),
  ]);
  if (conversationsResult.error || participantsResult.error || messagesResult.error)
    throw conversationsResult.error ?? participantsResult.error ?? messagesResult.error;
  const readAt = new Map(
    (mine ?? []).map((participant) => [
      participant.conversation_id,
      participant.last_read_at ? Date.parse(participant.last_read_at) : 0,
    ]),
  );
  return (conversationsResult.data ?? [])
    .map((conversation: any) => {
      const listing = conversation.listings;
      const picture = [...(listing?.listing_images ?? [])].sort(
        (a: any, b: any) => a.position - b.position,
      )[0];
      const other = (participantsResult.data ?? []).find(
        (participant: any) =>
          participant.conversation_id === conversation.id && participant.user_id !== auth.user!.id,
      );
      const otherProfile = Array.isArray(other?.profiles) ? other.profiles[0] : other?.profiles;
      const messages = (messagesResult.data ?? []).filter(
        (message: any) => message.conversation_id === conversation.id,
      );
      return {
        id: conversation.id,
        listingId: conversation.listing_id,
        listingTitle: listing?.title ?? "Oferta",
        listingImage: imageFor(picture?.storage_path),
        sellerName: otherProfile?.username ?? "Kolekcjoner",
        messages: messages.map((message: any) => ({
          id: message.id,
          from: message.sender_id === auth.user!.id ? "me" : "them",
          text: message.body,
          at: Date.parse(message.created_at),
        })),
        unread: messages.filter(
          (message: any) =>
            message.sender_id !== auth.user!.id &&
            Date.parse(message.created_at) > (readAt.get(conversation.id) ?? 0),
        ).length,
      } satisfies Conversation;
    })
    .sort((a, b) => (b.messages.at(-1)?.at ?? 0) - (a.messages.at(-1)?.at ?? 0));
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
