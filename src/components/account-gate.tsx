import { Link } from "@tanstack/react-router";
import { LockKeyhole } from "lucide-react";
import { useAccount } from "@/data/account";

export function AccountGate({ feature }: { feature: string }) {
  const { authLoading } = useAccount();
  if (authLoading)
    return (
      <p role="status" className="p-10 text-center">
        Sprawdzamy Twoją sesję…
      </p>
    );
  return (
    <section className="card-surface mx-auto max-w-xl p-10 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand">
        <LockKeyhole className="size-5" />
      </span>
      <h1 className="mt-4 text-xl font-bold">Zaloguj się, aby zobaczyć {feature}</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Te dane są dostępne wyłącznie dla właściciela konta.
      </p>
      <Link
        to="/logowanie"
        className="mt-5 inline-flex rounded-full bg-brand px-5 py-3 text-sm font-semibold text-brand-foreground"
      >
        Przejdź do logowania
      </Link>
    </section>
  );
}
