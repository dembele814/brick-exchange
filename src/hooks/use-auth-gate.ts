import { useNavigate } from "@tanstack/react-router";
import { useAccount } from "@/data/account";
import { requireSupabase } from "@/lib/supabase";
import { toast } from "sonner";

/**
 * Zwraca funkcję, która wykonuje akcję tylko dla zalogowanych.
 * Gość zostaje przeniesiony na ekran logowania.
 */
export function useAuthGate() {
  const { loggedIn } = useAccount();
  const navigate = useNavigate();

  return {
    loggedIn,
    guard: async (action: () => unknown | Promise<unknown>) => {
      try {
        const { data, error } = await requireSupabase().auth.getSession();
        if (error) throw error;
        if (!data.session) {
          await navigate({ to: "/logowanie" });
          return;
        }
        await action();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Nie udało się wykonać operacji. Spróbuj ponownie.",
        );
      }
    },
  };
}
