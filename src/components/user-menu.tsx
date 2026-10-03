import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Package, Settings, ShieldCheck, User, Wallet } from "lucide-react";
import { logout, useAccount } from "@/data/account";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const items = [
  { to: "/profil", label: "Mój profil", icon: User },
  { to: "/ustawienia", label: "Ustawienia", icon: Settings },
  { to: "/portfel", label: "Finanse i wypłaty", icon: Wallet },
  { to: "/zamowienia", label: "Zakupy i sprzedaże", icon: Package },
] as const;

export function UserMenu() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { profile, loggedIn, isAdmin } = useAccount();

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Konto"
          className="grid size-9 place-items-center overflow-hidden rounded-xl border border-border bg-card text-muted-foreground shadow-card transition-all hover:border-brand/40 hover:text-foreground"
        >
          {loggedIn ? (
            <img
              src={profile.avatar}
              alt=""
              width={36}
              height={36}
              className="size-full object-cover"
            />
          ) : (
            <User className="size-5" />
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={10}
        collisionPadding={12}
        className="z-[100] w-64 rounded-2xl border-border bg-popover p-2 shadow-lift"
      >
        {!loggedIn ? (
          <>
            <p className="px-3 py-2 text-sm text-muted-foreground">
              Oferty przeglądasz bez konta. Zaloguj się, aby kupować, polubić ofertę i pisać do
              sprzedających.
            </p>
            <DropdownMenuItem asChild className="mt-1 rounded-xl p-0 focus:bg-transparent">
              <Link
                to="/logowanie"
                className="block w-full rounded-xl bg-brand px-3 py-2.5 text-center text-sm font-semibold text-brand-foreground"
              >
                Zaloguj się
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="mt-1.5 rounded-xl p-0 focus:bg-transparent">
              <Link
                to="/logowanie"
                className="block w-full rounded-xl border border-border px-3 py-2.5 text-center text-sm font-semibold hover:bg-secondary"
              >
                Załóż konto
              </Link>
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 rounded-xl bg-secondary/70 px-3 py-2.5">
              <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-card">
                <img
                  src={profile.avatar}
                  alt=""
                  width={36}
                  height={36}
                  className="size-full object-cover"
                />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{profile.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {profile.rating} · {profile.reviews} opinii
                </span>
              </span>
            </div>

            <nav className="mt-1.5">
              {isAdmin && (
                <DropdownMenuItem asChild className="rounded-xl p-0 focus:bg-transparent">
                  <Link
                    to="/admin"
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-brand transition-colors hover:bg-brand-soft"
                  >
                    <ShieldCheck className="size-4" aria-hidden />
                    Panel administratora
                  </Link>
                </DropdownMenuItem>
              )}
              {items.map(({ to, label, icon: Icon }) => (
                <DropdownMenuItem key={to} asChild className="rounded-xl p-0 focus:bg-transparent">
                  <Link
                    to={to}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors hover:bg-secondary"
                  >
                    <Icon className="size-4 text-muted-foreground" aria-hidden />
                    {label}
                  </Link>
                </DropdownMenuItem>
              ))}
            </nav>

            <div className="mt-1.5 border-t border-border pt-1.5">
              <DropdownMenuItem asChild className="rounded-xl p-0 focus:bg-transparent">
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    navigate({ to: "/", search: { q: undefined } });
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-brand transition-colors hover:bg-brand-soft"
                >
                  <LogOut className="size-4" aria-hidden />
                  Wyloguj się
                </button>
              </DropdownMenuItem>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
