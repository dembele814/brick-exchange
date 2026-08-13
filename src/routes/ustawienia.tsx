import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Trash2 } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { updateProfile, useAccount } from "@/data/account";

export const Route = createFileRoute("/ustawienia")({
  head: () => ({
    meta: [
      { title: "Ustawienia konta — Klockownia" },
      {
        name: "description",
        content:
          "Zmień dane profilu, nazwę użytkownika, zdjęcie, hasło, tryb wakacyjny i ustawienia prywatności.",
      },
      { property: "og:title", content: "Ustawienia konta — Klockownia" },
      { property: "og:description", content: "Profil, konto, powiązania i prywatność." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

const countries = ["Polska", "Niemcy", "Czechy", "Wielka Brytania", "Holandia", "Inny"];
const languages = ["Polski", "English", "Deutsch"];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/40";

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <span className="text-sm">
        <span className="font-medium">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={
          checked
            ? "relative h-6 w-11 shrink-0 rounded-full bg-brand transition-colors"
            : "relative h-6 w-11 shrink-0 rounded-full bg-border transition-colors"
        }
      >
        <span
          className={
            checked
              ? "absolute top-0.5 left-[1.375rem] size-5 rounded-full bg-card transition-all"
              : "absolute top-0.5 left-0.5 size-5 rounded-full bg-card transition-all"
          }
        />
      </button>
    </div>
  );
}

function SettingsPage() {
  const { profile } = useAccount();
  const [saved, setSaved] = useState(false);

  const set = <K extends keyof typeof profile>(key: K, value: (typeof profile)[K]) => {
    updateProfile({ [key]: value } as never);
    setSaved(false);
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold sm:text-3xl">Ustawienia</h1>

        <section className="card-surface mt-6 space-y-4 p-5">
          <h2 className="text-lg font-semibold">Szczegóły profilu</h2>

          <div className="flex items-center gap-4">
            <img
              src={profile.avatar}
              alt="Twoje zdjęcie profilowe"
              width={72}
              height={72}
              className="size-16 rounded-full object-cover"
            />
            <label className="cursor-pointer rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold transition-colors hover:bg-secondary">
              Zmień zdjęcie
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) set("avatar", URL.createObjectURL(file));
                }}
              />
            </label>
          </div>

          <Field label="Nazwa użytkownika">
            <input
              className={inputClass}
              maxLength={40}
              value={profile.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Kraj">
              <select
                className={inputClass}
                value={profile.country}
                onChange={(e) => set("country", e.target.value)}
              >
                {countries.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Miasto (opcjonalnie)">
              <input
                className={inputClass}
                maxLength={60}
                value={profile.city}
                onChange={(e) => set("city", e.target.value)}
              />
            </Field>
          </div>

          <Field label="Język">
            <select
              className={inputClass}
              value={profile.language}
              onChange={(e) => set("language", e.target.value)}
            >
              {languages.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </Field>

          <Field label="Kilka słów o sobie">
            <textarea
              className={`${inputClass} min-h-28`}
              maxLength={500}
              value={profile.bio}
              onChange={(e) => set("bio", e.target.value)}
            />
          </Field>
        </section>

        <section className="card-surface mt-6 space-y-4 p-5">
          <h2 className="text-lg font-semibold">Ustawienia konta</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Imię i nazwisko">
              <input
                className={inputClass}
                value={profile.realName}
                onChange={(e) => set("realName", e.target.value)}
              />
            </Field>
            <Field label="Data urodzenia">
              <input
                type="date"
                className={inputClass}
                value={profile.birthDate}
                onChange={(e) => set("birthDate", e.target.value)}
              />
            </Field>
            <Field label="Płeć">
              <select
                className={inputClass}
                value={profile.gender}
                onChange={(e) => set("gender", e.target.value as typeof profile.gender)}
              >
                <option>Kobieta</option>
                <option>Mężczyzna</option>
                <option>Nie podaję</option>
              </select>
            </Field>
            <Field label="Adres e-mail">
              <input
                type="email"
                className={inputClass}
                value={profile.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </Field>
            <Field label="Numer telefonu">
              <input
                type="tel"
                className={inputClass}
                value={profile.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
            </Field>
          </div>

          <div className="divide-y divide-border border-t border-border">
            <Toggle
              label="Tryb wakacyjny"
              hint="Wszystkie Twoje ogłoszenia zostaną tymczasowo ukryte."
              checked={profile.vacationMode}
              onChange={(v) => set("vacationMode", v)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-full border border-border bg-card px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-secondary"
            >
              Zmień hasło
            </button>
            <button
              type="button"
              onClick={() => set("googleLinked", !profile.googleLinked)}
              className="rounded-full border border-border bg-card px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-secondary"
            >
              {profile.googleLinked ? "Odłącz Google" : "Połącz z Google"}
            </button>
            <button
              type="button"
              onClick={() => set("facebookLinked", !profile.facebookLinked)}
              className="rounded-full border border-border bg-card px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-secondary"
            >
              {profile.facebookLinked ? "Odłącz Facebooka" : "Połącz z Facebookiem"}
            </button>
          </div>
        </section>

        <section className="card-surface mt-6 p-5">
          <h2 className="text-lg font-semibold">Prywatność</h2>
          <div className="mt-2 divide-y divide-border">
            <Toggle
              label="Pokazuj moje miasto w profilu"
              checked={profile.showCity}
              onChange={(v) => set("showCity", v)}
            />
            <Toggle
              label="Profil widoczny publicznie"
              hint="Inni użytkownicy mogą przeglądać Twoje ogłoszenia i opinie."
              checked={profile.profileVisible}
              onChange={(v) => set("profileVisible", v)}
            />
            <Toggle
              label="Spersonalizowane reklamy"
              hint="Zezwalasz na dopasowanie treści na podstawie Twojej aktywności."
              checked={profile.personalisedAds}
              onChange={(v) => set("personalisedAds", v)}
            />
          </div>
        </section>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setSaved(true)}
            className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-brand-foreground transition-opacity hover:opacity-90"
          >
            <Check className="size-4" aria-hidden /> Zapisz zmiany
          </button>
          {saved && <span className="text-sm text-muted-foreground">Zapisano.</span>}
          <button
            type="button"
            className="ml-auto inline-flex items-center gap-2 rounded-full border border-destructive/40 px-4 py-2.5 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10"
          >
            <Trash2 className="size-4" aria-hidden /> Usuń konto
          </button>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
