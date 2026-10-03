import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Lock, Mail, User } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { login, register } from "@/data/account";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/logowanie")({
  head: () => ({
    meta: [
      { title: "Zaloguj się lub załóż konto — Klockownia" },
      {
        name: "description",
        content:
          "Przeglądaj oferty LEGO bez konta. Zaloguj się, aby kupować, polubić ofertę i pisać do sprzedających.",
      },
      { property: "og:title", content: "Zaloguj się lub załóż konto — Klockownia" },
      {
        property: "og:description",
        content: "Konto potrzebne jest tylko do zakupów, ulubionych i wiadomości.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const field =
    "mt-1.5 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-sm focus-within:ring-2 focus-within:ring-ring/40";

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 py-12">
        <h1 className="font-display text-3xl font-bold">
          {mode === "login" ? "Zaloguj się" : "Załóż konto"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Oferty przeglądasz bez konta. Konto potrzebne jest do zakupu, polubień i wiadomości.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-1 rounded-full border border-border bg-card p-1">
          {(
            [
              ["login", "Mam konto"],
              ["register", "Nowe konto"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                mode === key ? "bg-brand text-brand-foreground" : "hover:bg-secondary",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (mode === "register") register({ name, email });
            else login(email);
            navigate({ to: "/profil" });
          }}
        >
          {mode === "register" && (
            <label className="block text-sm font-medium">
              Nazwa użytkownika
              <span className={field}>
                <User className="size-4 text-muted-foreground" aria-hidden />
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="np. klockowy_maks"
                  className="w-full bg-transparent outline-none"
                />
              </span>
            </label>
          )}

          <label className="block text-sm font-medium">
            E-mail
            <span className={field}>
              <Mail className="size-4 text-muted-foreground" aria-hidden />
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ty@example.com"
                className="w-full bg-transparent outline-none"
              />
            </span>
          </label>

          <label className="block text-sm font-medium">
            Hasło
            <span className={field}>
              <Lock className="size-4 text-muted-foreground" aria-hidden />
              <input
                required
                type="password"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="min. 6 znaków"
                className="w-full bg-transparent outline-none"
              />
            </span>
          </label>

          <button
            type="submit"
            className="w-full rounded-full bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground transition-opacity hover:opacity-90"
          >
            {mode === "login" ? "Zaloguj się" : "Załóż konto"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link to="/" className="font-semibold text-brand hover:underline">
            Wróć do przeglądania ofert
          </Link>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
