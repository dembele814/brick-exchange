import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Lock } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { setRecoveredPassword } from "@/data/account";

export const Route = createFileRoute("/reset-hasla")({
  head: () => ({ meta: [{ title: "Ustaw nowe hasło — Klockogram" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 py-12">
        <Lock className="size-9 text-brand" aria-hidden />
        <h1 className="mt-4 text-3xl font-bold">Ustaw nowe hasło</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Wpisz nowe hasło dwa razy. Link z wiadomości e-mail jest jednorazowy.
        </p>
        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            if (password !== confirmation) {
              setError("Hasła nie są takie same.");
              return;
            }
            setSaving(true);
            void setRecoveredPassword(password)
              .then(() => navigate({ to: "/profil" }))
              .catch((cause) =>
                setError(
                  cause instanceof Error ? cause.message : "Nie udało się ustawić nowego hasła.",
                ),
              )
              .finally(() => setSaving(false));
          }}
        >
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Nowe hasło — min. 8 znaków"
            className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm"
          />
          <input
            type="password"
            required
            minLength={8}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder="Powtórz nowe hasło"
            className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm"
          />
          <button
            disabled={saving}
            className="w-full rounded-full bg-brand px-5 py-3 text-sm font-semibold text-brand-foreground disabled:opacity-60"
          >
            {saving ? "Zapisywanie…" : "Ustaw nowe hasło"}
          </button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </form>
        <Link to="/logowanie" className="mt-6 inline-block text-sm font-semibold text-brand">
          Wróć do logowania
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
