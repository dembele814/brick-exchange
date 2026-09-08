import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, CheckCheck, PackageCheck } from "lucide-react";
import { markAllNotificationsRead, markNotificationRead, useNotifications } from "@/data/notifications";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const Route = createFileRoute("/powiadomienia")({
  head: () => ({ meta: [{ title: "Powiadomienia — Klockownia" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { items, loading, error, unread, reload } = useNotifications();
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h1 className="text-2xl font-bold sm:text-3xl">Powiadomienia</h1><p className="mt-1 text-sm text-muted-foreground">Najważniejsze informacje o Twoich zakupach i sprzedaży.</p></div>
          {unread > 0 && <button type="button" onClick={() => void markAllNotificationsRead().then(reload)} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-secondary"><CheckCheck className="size-4" /> Oznacz jako przeczytane</button>}
        </div>
        <ul className="mt-6 space-y-3">
          {items.map((item) => {
            const content = <><div className={item.read ? "grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground" : "grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand"}><Bell className="size-4" /></div><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{item.title}</p><p className="mt-0.5 text-sm text-muted-foreground">{item.body}</p><p className="mt-1.5 text-xs text-muted-foreground">{item.at}</p></div>{!item.read && <span className="mt-1 size-2 shrink-0 rounded-full bg-brand" aria-label="Nieprzeczytane" />}</>;
            return <li key={item.id} className={item.read ? "card-surface flex gap-3 p-4" : "card-surface flex gap-3 border-brand/30 bg-brand-soft/35 p-4"}>{item.href ? <Link to={item.href} onClick={() => void markNotificationRead(item.id)} className="flex min-w-0 flex-1 gap-3">{content}</Link> : <button type="button" onClick={() => void markNotificationRead(item.id).then(reload)} className="flex min-w-0 flex-1 gap-3 text-left">{content}</button>}</li>;
          })}
        </ul>
        {loading && <p className="mt-6 text-sm text-muted-foreground">Wczytujemy powiadomienia…</p>}
        {error && <p className="mt-6 text-sm text-destructive">{error}</p>}
        {!loading && !error && items.length === 0 && <div className="mt-6 rounded-3xl border border-dashed border-border p-10 text-center"><PackageCheck className="mx-auto size-8 text-brand" /><p className="mt-3 text-sm text-muted-foreground">Nie masz jeszcze żadnych powiadomień.</p></div>}
      </main>
      <SiteFooter />
    </div>
  );
}
