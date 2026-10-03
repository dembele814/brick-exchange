import { useEffect, useState } from "react";
import { requireSupabase, supabase } from "@/lib/supabase";

export type Notification = {
  id: number;
  kind: "payment" | "shipment" | "delivery" | "review" | "system";
  title: string;
  body: string;
  href: string | null;
  read: boolean;
  at: string;
};

async function loadNotifications() {
  const { data: auth } = await requireSupabase().auth.getUser();
  if (!auth.user) return [] as Notification[];
  const { data, error } = await requireSupabase().from("notifications")
    .select("id,kind,title,body,href,read_at,created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map((item: any) => ({
    id: item.id, kind: item.kind, title: item.title, body: item.body, href: item.href,
    read: Boolean(item.read_at),
    at: new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.created_at)),
  })) as Notification[];
}

export function useNotifications() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!supabase) return;
    void loadNotifications().then(setItems).catch((cause) => setError(cause instanceof Error ? cause.message : "Nie udało się pobrać powiadomień.")).finally(() => setLoading(false));
  }, [revision]);
  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let channel: ReturnType<typeof client.channel> | undefined;
    void client.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      channel = client
        .channel(`notifications:${data.user.id}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${data.user.id}` }, () => setRevision((value) => value + 1))
        .subscribe();
    });
    return () => { if (channel) void client.removeChannel(channel); };
  }, []);
  return { items, loading, error, unread: items.filter((item) => !item.read).length, reload: () => setRevision((value) => value + 1) };
}

export async function markNotificationRead(id: number) {
  const { error } = await requireSupabase().from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function markAllNotificationsRead() {
  const { data: auth } = await requireSupabase().auth.getUser();
  if (!auth.user) return;
  const { error } = await requireSupabase().from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", auth.user.id).is("read_at", null);
  if (error) throw error;
}
