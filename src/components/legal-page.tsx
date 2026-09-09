import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-10">
          <p className="text-sm font-semibold text-brand">Klockownia</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            {title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Ostatnia aktualizacja: {updated}</p>
          <div className="mt-8 space-y-8 text-sm leading-7 text-foreground [&_a]:font-semibold [&_a]:text-brand [&_a]:underline [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_p]:mt-2 [&_ul]:mt-2 [&_ul]:space-y-1">
            {children}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
