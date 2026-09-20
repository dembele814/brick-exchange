import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  CheckCircle2,
  Globe2,
  Languages,
  LoaderCircle,
  Lock,
  Mail,
  MapPin,
  MessageSquare,
  User,
  XCircle,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import {
  isUsernameAvailable,
  currentAccountHasProfile,
  login,
  loginWithGoogle,
  register,
  sendPasswordResetForEmail,
} from "@/data/account";
import { cn } from "@/lib/utils";

const countries = [
  "Polska",
  "Niemcy",
  "Czechy",
  "Słowacja",
  "Litwa",
  "Wielka Brytania",
  "Holandia",
  "Inny",
];
const languages = ["Polski", "English", "Deutsch", "Čeština", "Slovenčina", "Lietuvių"];

export const Route = createFileRoute("/logowanie")({
  head: () => ({
    meta: [
      { title: "Zaloguj się lub załóż konto — Klockogram" },
      {
        name: "description",
        content:
          "Przeglądaj oferty LEGO bez konta. Zaloguj się, aby kupować, polubić ofertę i pisać do sprzedających.",
      },
      { property: "og:title", content: "Zaloguj się lub załóż konto — Klockogram" },
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
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [language, setLanguage] = useState("");
  const [bio, setBio] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [nameAvailability, setNameAvailability] = useState<"idle" | "checking" | "free" | "taken">(
    "idle",
  );

  async function checkName() {
    if (mode !== "register" || !/^[a-zA-Z0-9_.-]{3,40}$/.test(name.trim())) {
      setNameAvailability("idle");
      return false;
    }
    setNameAvailability("checking");
    try {
      const free = await isUsernameAvailable(name);
      setNameAvailability(free ? "free" : "taken");
      return free;
    } catch {
      setNameAvailability("idle");
      return false;
    }
  }

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

        {mode === "register" && (
          <section className="mt-6 space-y-4 rounded-2xl border border-border bg-card p-4">
            <p className="text-sm font-semibold">Ustaw swój profil</p>
            <label className="block text-sm font-medium">
              Nick
              <span className={field}>
                <User className="size-4 text-muted-foreground" aria-hidden />
                <input
                  required
                  minLength={3}
                  maxLength={40}
                  pattern="[a-zA-Z0-9_.-]+"
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    setNameAvailability("idle");
                  }}
                  onBlur={() => void checkName()}
                  placeholder="Wpisz swój nick"
                  className="w-full bg-transparent outline-none"
                />
                {nameAvailability === "checking" && (
                  <LoaderCircle className="size-4 animate-spin text-muted-foreground" />
                )}
                {nameAvailability === "free" && <CheckCircle2 className="size-4 text-mint" />}
                {nameAvailability === "taken" && <XCircle className="size-4 text-destructive" />}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                3–40 znaków: litery, cyfry, kropka, myślnik lub podkreślenie.
              </span>
              {nameAvailability === "free" && (
                <span className="mt-1 block text-xs font-semibold text-mint">
                  Ten nick jest wolny.
                </span>
              )}
              {nameAvailability === "taken" && (
                <span className="mt-1 block text-xs font-semibold text-destructive">
                  Ten nick jest już używany. Wybierz inny.
                </span>
              )}
            </label>
            <label className="block text-sm font-medium">
              Kraj
              <span className={field}>
                <Globe2 className="size-4 text-muted-foreground" aria-hidden />
                <select
                  required
                  value={country}
                  onChange={(event) => setCountry(event.target.value)}
                  className="w-full bg-transparent outline-none"
                >
                  <option value="" disabled>
                    Wybierz kraj
                  </option>
                  {countries.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </span>
            </label>
            <label className="block text-sm font-medium">
              Miasto
              <span className={field}>
                <MapPin className="size-4 text-muted-foreground" aria-hidden />
                <input
                  required
                  maxLength={80}
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  placeholder="Wpisz swoje miasto"
                  className="w-full bg-transparent outline-none"
                />
              </span>
            </label>
            <label className="block text-sm font-medium">
              Język
              <span className={field}>
                <Languages className="size-4 text-muted-foreground" aria-hidden />
                <select
                  required
                  value={language}
                  onChange={(event) => setLanguage(event.target.value)}
                  className="w-full bg-transparent outline-none"
                >
                  <option value="" disabled>
                    Wybierz język
                  </option>
                  {languages.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </span>
            </label>
            <label className="block text-sm font-medium">
              Kilka słów o sobie{" "}
              <span className="font-normal text-muted-foreground">(opcjonalnie)</span>
              <span className={`${field} items-start`}>
                <MessageSquare className="mt-0.5 size-4 text-muted-foreground" aria-hidden />
                <textarea
                  maxLength={500}
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  placeholder="Np. napisz, jakie zestawy lubisz albo jak przygotowujesz przesyłki."
                  className="min-h-20 w-full resize-y bg-transparent outline-none"
                />
              </span>
            </label>
          </section>
        )}

        <button
          type="button"
          disabled={submitting}
          onClick={() => {
            if (mode === "register" && !acceptedTerms) {
              setError("Potwierdź pełnoletność i zaakceptuj regulamin oraz politykę prywatności.");
              return;
            }
            setSubmitting(true);
            setError(null);
            void (async () => {
              if (mode === "register" && !(await checkName()))
                throw new Error("Ten nick jest już zajęty. Wybierz inny nick.");
              return loginWithGoogle(
                mode === "register" ? { name, country, city, language, bio } : undefined,
              );
            })()
              .catch((cause) =>
                setError(
                  cause instanceof Error ? cause.message : "Nie udało się połączyć z Google.",
                ),
              )
              .finally(() => setSubmitting(false));
          }}
          className="mt-6 flex w-full items-center justify-center gap-3 rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold transition-colors hover:bg-secondary disabled:opacity-60"
        >
          <span className="grid size-6 place-items-center rounded-full bg-white font-bold text-[#4285f4] shadow-sm">
            G
          </span>
          Kontynuuj przez Google
        </button>

        <div className="my-5 flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          lub e-mail
          <span className="h-px flex-1 bg-border" />
        </div>

        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            if (mode === "register" && !acceptedTerms) {
              setError("Potwierdź pełnoletność i zaakceptuj regulamin oraz politykę prywatności.");
              return;
            }
            setSubmitting(true);
            try {
              if (mode === "register" && !(await checkName())) {
                setError("Ten nick jest już zajęty. Wybierz inny nick.");
                return;
              }
              const result =
                mode === "register"
                  ? await register({ name, country, city, language, bio, email, password })
                  : await login(email, password);
              if (mode === "register" && !result.session) {
                setError(
                  "Konto utworzone. Sprawdź e-mail i kliknij link potwierdzający, aby się zalogować.",
                );
                return;
              }
              if (!(await currentAccountHasProfile())) {
                navigate({ to: "/rejestracja-google" });
                return;
              }
              navigate({ to: "/profil" });
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : "Nie udało się zalogować.");
            } finally {
              setSubmitting(false);
            }
          }}
        >
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

          {mode === "register" && (
            <label className="flex items-start gap-3 rounded-2xl border border-border bg-card p-3 text-sm">
              <input
                required
                type="checkbox"
                checked={acceptedTerms}
                onChange={(event) => setAcceptedTerms(event.target.checked)}
                className="mt-0.5 size-4 accent-brand"
              />
              <span>
                Mam co najmniej 18 lat i akceptuję{" "}
                <Link to="/regulamin" className="font-semibold text-brand hover:underline">
                  regulamin
                </Link>{" "}
                oraz{" "}
                <Link
                  to="/polityka-prywatnosci"
                  className="font-semibold text-brand hover:underline"
                >
                  politykę prywatności
                </Link>
                .
              </span>
            </label>
          )}

          {mode === "login" && (
            <button
              type="button"
              disabled={resetting}
              onClick={() => {
                setResetting(true);
                setError(null);
                setResetMessage(null);
                void sendPasswordResetForEmail(email)
                  .then(() =>
                    setResetMessage(
                      "Jeśli konto istnieje, wysłaliśmy link do ustawienia nowego hasła.",
                    ),
                  )
                  .catch((cause) =>
                    setError(
                      cause instanceof Error ? cause.message : "Nie udało się wysłać linku.",
                    ),
                  )
                  .finally(() => setResetting(false));
              }}
              className="block text-sm font-semibold text-brand hover:underline disabled:opacity-60"
            >
              {resetting ? "Wysyłanie linku…" : "Nie pamiętam hasła"}
            </button>
          )}

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
            disabled={
              submitting ||
              (mode === "register" && (!acceptedTerms || nameAvailability === "taken"))
            }
            className="w-full rounded-full bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground transition-opacity hover:opacity-90"
          >
            {submitting ? "Trwa przetwarzanie…" : mode === "login" ? "Zaloguj się" : "Załóż konto"}
          </button>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {resetMessage && <p className="text-sm font-medium text-mint">{resetMessage}</p>}
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link
            to="/"
            search={{ q: undefined }}
            className="font-semibold text-brand hover:underline"
          >
            Wróć do przeglądania ofert
          </Link>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
