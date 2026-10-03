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
    <div className="min-h-screen min-w-0 overflow-x-hidden">
      <SiteHeader />
      <main className="mx-auto w-full min-w-0 max-w-3xl px-3 py-7 sm:px-4 sm:py-14">
        <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm sm:rounded-3xl sm:p-10">
          <p className="text-sm font-semibold text-brand">Klockogram</p>
          <h1 className="mt-2 break-words font-display text-2xl font-bold tracking-tight sm:text-4xl">
            {title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Ostatnia aktualizacja: {updated}</p>
          <div className="mt-7 min-w-0 space-y-8 break-words text-sm leading-7 text-foreground [overflow-wrap:anywhere] [&_a]:font-semibold [&_a]:text-brand [&_a]:underline [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_p]:mt-2 [&_ul]:mt-2 [&_ul]:space-y-1">
            {children}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
