import { useEffect, useState } from "react";
import { listings } from "./listings";

export type Message = {
  id: string;
  from: "me" | "them";
  text: string;
  at: number;
};

export type Conversation = {
  id: string;
  sellerName: string;
  listingId: string;
  listingTitle: string;
  listingImage: string;
  messages: Message[];
  unread: number;
};

const minutes = (n: number) => Date.now() - n * 60_000;

function seed(): Conversation[] {
  const a = listings[0]!;
  const b = listings[1]!;
  return [
    {
      id: "c1",
      sellerName: a.seller.name,
      listingId: a.id,
      listingTitle: a.title,
      listingImage: a.image,
      unread: 1,
      messages: [
        { id: "m1", from: "me", text: "Dzień dobry, czy zestaw jest kompletny?", at: minutes(90) },
        {
          id: "m2",
          from: "them",
          text: "Cześć! Tak, wszystkie elementy są na miejscu, instrukcja też.",
          at: minutes(40),
        },
      ],
    },
    {
      id: "c2",
      sellerName: b.seller.name,
      listingId: b.id,
      listingTitle: b.title,
      listingImage: b.image,
      unread: 0,
      messages: [
        { id: "m3", from: "me", text: "Wysyła Pan do paczkomatu?", at: minutes(600) },
        { id: "m4", from: "them", text: "Tak, paczkomat 12 zł.", at: minutes(560) },
      ],
    },
  ];
}

let conversations: Conversation[] = seed();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function useConversations() {
  const [state, setState] = useState(conversations);
  useEffect(() => {
    const l = () => setState([...conversations]);
    listeners.add(l);
    l();
    return () => {
      listeners.delete(l);
    };
  }, []);
  return state;
}

export function useUnreadCount() {
  return useConversations().reduce((sum, c) => sum + c.unread, 0);
}

export function markRead(conversationId: string) {
  conversations = conversations.map((c) =>
    c.id === conversationId ? { ...c, unread: 0 } : c,
  );
  emit();
}

export function sendMessage(conversationId: string, text: string) {
  conversations = conversations.map((c) =>
    c.id === conversationId
      ? {
          ...c,
          unread: 0,
          messages: [
            ...c.messages,
            { id: `m${Date.now()}`, from: "me" as const, text, at: Date.now() },
          ],
        }
      : c,
  );
  emit();
}

/** Opens (or creates) a conversation with the seller of a listing. Returns its id. */
export function startConversation(listingId: string) {
  const existing = conversations.find((c) => c.listingId === listingId);
  if (existing) return existing.id;
  const listing = listings.find((l) => l.id === listingId);
  if (!listing) return conversations[0]?.id ?? "";
  const id = `c${Date.now()}`;
  conversations = [
    {
      id,
      sellerName: listing.seller.name,
      listingId: listing.id,
      listingTitle: listing.title,
      listingImage: listing.image,
      unread: 0,
      messages: [],
    },
    ...conversations,
  ];
  emit();
  return id;
}

export function formatTime(at: number) {
  const diff = Math.round((Date.now() - at) / 60_000);
  if (diff < 1) return "teraz";
  if (diff < 60) return `${diff} min`;
  const h = Math.round(diff / 60);
  if (h < 24) return `${h} godz.`;
  return `${Math.round(h / 24)} dni`;
}
