import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, MessageCircle, Send } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { AccountGate } from "@/components/account-gate";
import { useAccount } from "@/data/account";
import { formatTime, markRead, sendMessage, useConversations } from "@/data/messages";

export const Route = createFileRoute("/wiadomosci")({
  validateSearch: (search: Record<string, unknown>) => ({
    c: typeof search["c"] === "string" ? (search["c"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Wiadomości — Klockownia" },
      {
        name: "description",
        content:
          "Skrzynka odbiorcza Klockowni: rozmowy ze sprzedającymi o zestawach, wysyłce i stanie klocków.",
      },
      { property: "og:title", content: "Wiadomości — Klockownia" },
      {
        property: "og:description",
        content: "Pisz do sprzedających i śledź odpowiedzi w jednym miejscu.",
      },
    ],
  }),
  component: Inbox,
});

function Inbox() {
  const { loggedIn } = useAccount();
  const { conversations, error: loadError, loading, reload } = useConversations();
  const { c } = Route.useSearch();
  const navigate = useNavigate();
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLLIElement>(null);

  const activeId = c ?? conversations[0]?.id;
  const active = conversations.find((x) => x.id === activeId);

  useEffect(() => {
    if (activeId)
      void markRead(activeId).catch(() =>
        setSendError("Nie udało się oznaczyć rozmowy jako przeczytanej."),
      );
  }, [activeId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [activeId, active?.messages.length]);

  const select = (id: string) => navigate({ to: "/wiadomosci", search: { c: id } });

  if (!loggedIn)
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-6xl px-4 py-12">
          <AccountGate feature="wiadomości" />
        </main>
        <SiteFooter />
      </div>
    );

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Link
          to="/"
          search={{ q: undefined }}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Wróć do ofert
        </Link>

        <h1 className="mt-4 text-2xl font-bold">Wiadomości</h1>
        {loadError && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {loadError}{" "}
            <button type="button" onClick={reload} className="underline">
              Spróbuj ponownie
            </button>
          </p>
        )}
        {loading && (
          <p role="status" className="mt-3 text-sm">
            Wczytujemy rozmowy…
          </p>
        )}
        <p className="mt-1 text-sm text-muted-foreground">
          Wybierz rozmowę po lewej i napisz odpowiedź.
        </p>

        <div className="mt-6 grid gap-4 lg:grid-cols-[320px_1fr]">
          <ul className="space-y-2">
            {conversations.map((conv) => {
              const last = conv.messages[conv.messages.length - 1];
              const isActive = conv.id === activeId;
              return (
                <li key={conv.id}>
                  <button
                    type="button"
                    onClick={() => select(conv.id)}
                    aria-current={isActive}
                    className={
                      "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors " +
                      (isActive
                        ? "border-brand bg-brand-soft"
                        : "border-border bg-card hover:bg-secondary")
                    }
                  >
                    <img
                      src={conv.listingImage}
                      alt=""
                      width={96}
                      height={96}
                      loading="lazy"
                      className="size-12 rounded-lg object-cover"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold">{conv.sellerName}</span>
                        {last && (
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {formatTime(last.at)}
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {last?.text ?? "Nowa rozmowa"}
                      </span>
                    </span>
                    {conv.unread > 0 && !isActive && (
                      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand text-[10px] font-bold text-brand-foreground">
                        {conv.unread}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          <section className="flex min-h-[420px] flex-col rounded-xl border border-border bg-card">
            {active ? (
              <>
                <header className="flex items-center gap-3 border-b border-border p-4">
                  <img
                    src={active.listingImage}
                    alt=""
                    width={96}
                    height={96}
                    className="size-11 rounded-lg object-cover"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{active.sellerName}</p>
                    <Link
                      to="/oferta/$id"
                      params={{ id: active.listingId }}
                      className="block truncate text-xs text-muted-foreground hover:text-foreground"
                    >
                      {active.listingTitle}
                    </Link>
                  </div>
                </header>

                <ul className="flex-1 space-y-3 overflow-y-auto p-4">
                  {active.messages.length === 0 && (
                    <li className="text-sm text-muted-foreground">
                      Zacznij rozmowę — zapytaj o kompletność, wysyłkę albo cenę.
                    </li>
                  )}
                  {active.messages.map((m) => (
                    <li
                      key={m.id}
                      className={m.from === "me" ? "flex justify-end" : "flex justify-start"}
                    >
                      <span
                        className={
                          "max-w-[75%] rounded-2xl px-4 py-2 text-sm " +
                          (m.from === "me"
                            ? "bg-brand text-brand-foreground"
                            : "bg-secondary text-secondary-foreground")
                        }
                      >
                        {m.text}
                        <span className="mt-1 block text-[10px] opacity-70">
                          {formatTime(m.at)}
                        </span>
                      </span>
                    </li>
                  ))}
                  <li ref={messagesEndRef} />
                </ul>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const text = draft.trim();
                    if (!text) return;
                    setSending(true);
                    setSendError(null);
                    try {
                      await sendMessage(active.id, text);
                      setDraft("");
                    } catch (error) {
                      setSendError(
                        error instanceof Error
                          ? error.message
                          : "Nie udało się wysłać wiadomości. Spróbuj ponownie.",
                      );
                    } finally {
                      setSending(false);
                    }
                  }}
                  className="border-t border-border p-3"
                >
                  <div className="flex items-center gap-2">
                    <label className="sr-only" htmlFor="msg">
                      Treść wiadomości
                    </label>
                    <input
                      ref={inputRef}
                      id="msg"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      maxLength={2000}
                      placeholder="Napisz wiadomość…"
                      className="flex-1 rounded-full border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/40"
                    />
                    <button
                      type="submit"
                      disabled={sending}
                      className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
                    >
                      <Send className="size-4" aria-hidden />
                      {sending ? "Wysyłanie…" : "Wyślij"}
                    </button>
                  </div>
                  {active.messages.length < 2 && (
                    <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                      {[
                        "Czy zestaw jest kompletny?",
                        "Czy pudełko i instrukcja są w zestawie?",
                        "Czy możesz wysłać dodatkowe zdjęcie?",
                      ].map((question) => (
                        <button
                          key={question}
                          type="button"
                          onClick={() => {
                            setDraft(question);
                            inputRef.current?.focus();
                          }}
                          className="shrink-0 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-brand-soft"
                        >
                          {question}
                        </button>
                      ))}
                    </div>
                  )}
                  {sendError && <p className="mt-2 px-1 text-xs text-destructive">{sendError}</p>}
                </form>
              </>
            ) : (
              <div className="grid flex-1 place-items-center p-10 text-center">
                <div>
                  <MessageCircle className="mx-auto size-8 text-muted-foreground" aria-hidden />
                  <p className="mt-3 text-sm text-muted-foreground">
                    {loading
                      ? "Wczytujemy Twoje wiadomości…"
                      : loadError
                        ? "Rozmowy są chwilowo niedostępne."
                        : "Nie masz jeszcze wiadomości. Otwórz ofertę i napisz do sprzedającego."}
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
