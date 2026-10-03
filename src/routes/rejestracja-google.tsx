import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, LoaderCircle, XCircle } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  completeGoogleRegistration,
  currentAccountHasProfile,
  getPendingGoogleRegistration,
  isUsernameAvailable,
  type RegistrationProfile,
} from "@/data/account";

export const Route = createFileRoute("/rejestracja-google")({
  head: () => ({ meta: [{ title: "Dokończ rejestrację — Klockogram" }] }),
  component: GoogleRegistrationPage,
});

const emptyProfile: RegistrationProfile = {
  name: "",
  country: "",
  city: "",
  language: "",
  bio: "",
};

function GoogleRegistrationPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<RegistrationProfile>(
    () => getPendingGoogleRegistration() ?? emptyProfile,
  );
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<"idle" | "checking" | "free" | "taken">("idle");

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        if (await currentAccountHasProfile()) {
          navigate({ to: "/profil", replace: true });
          return;
        }
        const pending = getPendingGoogleRegistration();
        if (pending) {
          await completeGoogleRegistration(pending);
          navigate({ to: "/profil", replace: true });
          return;
        }
      } catch (cause) {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Nie udało się dokończyć rejestracji.");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [navigate]);

  async function checkName() {
    if (!/^[a-zA-Z0-9_.-]{3,40}$/.test(profile.name.trim())) {
      setAvailability("idle");
      return false;
    }
    setAvailability("checking");
    try {
      const free = await isUsernameAvailable(profile.name);
      setAvailability(free ? "free" : "taken");
      return free;
    } catch {
      setAvailability("idle");
      return false;
    }
  }

  if (loading)
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto grid max-w-md place-items-center px-4 py-24 text-center">
          <LoaderCircle className="size-8 animate-spin text-brand" />
          <h1 className="mt-4 text-2xl font-bold">Dokańczamy rejestrację…</h1>
        </main>
      </div>
    );

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 py-12">
        <h1 className="text-3xl font-bold">Ustaw swój nick</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Klockogram nigdy nie nadaje automatycznej nazwy. Wybierz własny, wolny nick, aby dokończyć
          rejestrację.
        </p>
        <form
          className="card-surface mt-6 space-y-4 p-5"
          onSubmit={async (event) => {
            event.preventDefault();
            setError(null);
            setSubmitting(true);
            try {
              if (!(await checkName())) {
                setError("Ten nick jest już zajęty. Wybierz inny nick.");
                return;
              }
              await completeGoogleRegistration(profile);
              navigate({ to: "/profil", replace: true });
            } catch (cause) {
              setError(
                cause instanceof Error ? cause.message : "Nie udało się dokończyć rejestracji.",
              );
            } finally {
              setSubmitting(false);
            }
          }}
        >
          <label className="block text-sm font-semibold">
            Nick
            <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5">
              <input
                required
                autoFocus
                minLength={3}
                maxLength={40}
                pattern="[a-zA-Z0-9_.-]+"
                value={profile.name}
                onChange={(event) => {
                  setProfile((value) => ({ ...value, name: event.target.value }));
                  setAvailability("idle");
                }}
                onBlur={() => void checkName()}
                placeholder="Wpisz swój nick"
                className="min-w-0 flex-1 bg-transparent outline-none"
              />
              {availability === "checking" && <LoaderCircle className="size-4 animate-spin" />}
              {availability === "free" && <CheckCircle2 className="size-4 text-mint" />}
              {availability === "taken" && <XCircle className="size-4 text-destructive" />}
            </div>
            <span className="mt-1 block text-xs font-normal text-muted-foreground">
              3–40 znaków: litery, cyfry, kropka, myślnik lub podkreślenie.
            </span>
            {availability === "free" && (
              <span className="mt-1 block text-xs font-semibold text-mint">
                Ten nick jest wolny.
              </span>
            )}
            {availability === "taken" && (
              <span className="mt-1 block text-xs font-semibold text-destructive">
                Ten nick jest już używany. Wybierz inny.
              </span>
            )}
          </label>
          <label className="block text-sm font-semibold">
            Kraj
            <input
              required
              value={profile.country}
              onChange={(event) =>
                setProfile((value) => ({ ...value, country: event.target.value }))
              }
              placeholder="Wpisz kraj"
              className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 outline-none"
            />
          </label>
          <label className="block text-sm font-semibold">
            Miasto
            <input
              required
              value={profile.city}
              onChange={(event) => setProfile((value) => ({ ...value, city: event.target.value }))}
              placeholder="Wpisz miasto"
              className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 outline-none"
            />
          </label>
          <label className="block text-sm font-semibold">
            Język
            <input
              required
              value={profile.language}
              onChange={(event) =>
                setProfile((value) => ({ ...value, language: event.target.value }))
              }
              placeholder="Np. Polski"
              className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 outline-none"
            />
          </label>
          <label className="block text-sm font-semibold">
            Kilka słów o sobie{" "}
            <span className="font-normal text-muted-foreground">(opcjonalnie)</span>
            <textarea
              maxLength={500}
              value={profile.bio}
              onChange={(event) => setProfile((value) => ({ ...value, bio: event.target.value }))}
              placeholder="Napisz kilka słów o sobie"
              className="mt-1.5 min-h-20 w-full resize-y rounded-xl border border-border bg-background px-3 py-2.5 outline-none"
            />
          </label>
          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting || availability === "taken"}
            className="button-gradient w-full rounded-xl px-5 py-3 text-sm font-bold disabled:opacity-50"
          >
            {submitting ? "Sprawdzanie…" : "Dokończ rejestrację"}
          </button>
        </form>
      </main>
      <SiteFooter />
    </div>
  );
}
