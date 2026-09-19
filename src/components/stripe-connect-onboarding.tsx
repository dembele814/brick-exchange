import { loadConnectAndInitialize, type StripeConnectInstance } from "@stripe/connect-js";
import {
  ConnectAccountOnboarding,
  ConnectComponentsProvider,
} from "@stripe/react-connect-js";
import { useEffect, useRef, useState } from "react";
import { authenticatedRequest } from "@/lib/authenticated-request";
import { requireSupabase } from "@/lib/supabase";

type SessionResponse = {
  clientSecret?: string;
  publishableKey?: string;
  error?: string;
};

async function fetchAccountSession() {
  const response = await authenticatedRequest(requireSupabase(), "/api/connect", {
    method: "PUT",
  });
  const result = (await response.json()) as SessionResponse;
  if (!response.ok || !result.clientSecret || !result.publishableKey)
    throw new Error(result.error ?? "Nie udało się uruchomić weryfikacji wypłat.");
  return { clientSecret: result.clientSecret, publishableKey: result.publishableKey };
}

export function StripeConnectOnboarding({
  bootstrap,
  onExit,
}: {
  bootstrap: { clientSecret: string; publishableKey: string };
  onExit: () => void;
}) {
  const firstSecret = useRef(bootstrap.clientSecret);
  const [connectInstance, setConnectInstance] = useState<StripeConnectInstance | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const instance = loadConnectAndInitialize({
      publishableKey: bootstrap.publishableKey,
      locale: "pl-PL",
      appearance: {
        overlays: "dialog",
        variables: {
          colorPrimary: "#075985",
          borderRadius: "16px",
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        },
      },
      fetchClientSecret: async () => {
        if (firstSecret.current) {
          const secret = firstSecret.current;
          firstSecret.current = "";
          return secret;
        }
        return (await fetchAccountSession()).clientSecret;
      },
    });
    if (active) setConnectInstance(instance);
    return () => {
      active = false;
    };
  }, [bootstrap.publishableKey]);

  if (!connectInstance)
    return <p className="text-sm font-semibold text-muted-foreground">Ładujemy bezpieczny formularz…</p>;

  return (
    <div className="rounded-2xl border border-sky/25 bg-card p-3 sm:p-5">
      <ConnectComponentsProvider connectInstance={connectInstance}>
        <ConnectAccountOnboarding
          onExit={onExit}
          onLoadError={() => setLoadError("Nie udało się załadować formularza Stripe.")}
          collectionOptions={{ fields: "eventually_due", futureRequirements: "include" }}
          recipientTermsOfServiceUrl="https://bricklane-market.lovable.app/regulamin"
          privacyPolicyUrl="https://bricklane-market.lovable.app/polityka-prywatnosci"
        />
      </ConnectComponentsProvider>
      {loadError && <p className="mt-3 text-sm text-destructive">{loadError}</p>}
    </div>
  );
}
