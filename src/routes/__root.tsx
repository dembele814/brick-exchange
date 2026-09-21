import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

const siteUrl = "https://klockogram.pl";
const websiteStructuredData = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Klockogram",
  alternateName: ["Klockogram.pl", "Klockogram marketplace"],
  url: `${siteUrl}/`,
  description: "Polski marketplace używanych zestawów, minifigurek i klocków LEGO.",
  inLanguage: "pl-PL",
  potentialAction: {
    "@type": "SearchAction",
    target: `${siteUrl}/?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Nie znaleziono strony</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Ten adres nie istnieje albo strona została przeniesiona.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            search={{ q: undefined }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Wróć na stronę główną
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Nie udało się wczytać strony
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Wystąpił chwilowy błąd. Spróbuj ponownie albo wróć na stronę główną.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Spróbuj ponownie
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Strona główna
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Klockogram — marketplace klocków LEGO" },
      {
        name: "description",
        content: "Kupuj i sprzedawaj używane zestawy, minifigurki i klocki LEGO.",
      },
      { property: "og:title", content: "Klockogram — marketplace klocków LEGO" },
      {
        property: "og:description",
        content: "Kupuj i sprzedawaj używane zestawy, minifigurki i klocki LEGO.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${siteUrl}/` },
      { property: "og:site_name", content: "Klockogram" },
      { property: "og:locale", content: "pl_PL" },
      { property: "og:image", content: "/klockogram-mark.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "/klockogram-mark.png" },
      { name: "theme-color", content: "#120f1c" },
      {
        name: "keywords",
        content: "Klockogram, używane LEGO, marketplace LEGO, kup klocki, sprzedaj klocki",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&display=swap",
      },
      { rel: "icon", href: "/klockogram-mark.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/klockogram-mark.png" },
      { rel: "manifest", href: "/site.webmanifest" },
      { rel: "canonical", href: `${siteUrl}/` },
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pl">
      <head>
        <HeadContent />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteStructuredData) }}
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <Toaster />
    </QueryClientProvider>
  );
}
