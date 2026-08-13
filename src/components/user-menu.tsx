import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Package, Settings, User, Wallet } from "lucide-react";
import { logout, useAccount } from "@/data/account";

const items = [
  { to: "/profil", label: "Mój profil", icon: User },
  { to: "/ustawienia", label: "Ustawienia", icon: Settings },
  { to: "/portfel", label: "Portfel", icon: Wallet },
  { to: "/zamowienia", label: "Moje zamówienia", icon: Package },
] as const;

export function UserMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { profile, loggedIn } = useAccount();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Konto"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="grid size-9 place-items-center overflow-hidden rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
      >
        {loggedIn ? (
          <img src={profile.avatar} alt="" width={36} height={36} className="size-full object-cover" />
        ) : (
          <User className="size-5" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-2xl border border-border bg-popover p-2 shadow-lift">
          <div className="flex items-center gap-3 rounded-xl bg-secondary/70 px-3 py-2.5">
            <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-card">
              <img src={profile.avatar} alt="" width={36} height={36} className="size-full object-cover" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{profile.name}</span>
              <span className="block text-xs text-muted-foreground">
                {profile.rating} · {profile.reviews} opinii
              </span>
            </span>
          </div>

          <nav className="mt-1.5">
            {items.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors hover:bg-secondary"
              >
                <Icon className="size-4 text-muted-foreground" aria-hidden />
                {label}
              </Link>
            ))}
          </nav>

          <div className="mt-1.5 border-t border-border pt-1.5">
            <button
              type="button"
              onClick={() => {
                logout();
                setOpen(false);
                navigate({ to: "/" });
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-brand transition-colors hover:bg-brand-soft"
            >
              <LogOut className="size-4" aria-hidden />
              Wyloguj się
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
