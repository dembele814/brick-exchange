import { useNavigate } from "@tanstack/react-router";
import { useAccount } from "@/data/account";

/**
 * Zwraca funkcję, która wykonuje akcję tylko dla zalogowanych.
 * Gość zostaje przeniesiony na ekran logowania.
 */
export function useAuthGate() {
  const { loggedIn } = useAccount();
  const navigate = useNavigate();

  return {
    loggedIn,
    guard: (action: () => void) => {
      if (!loggedIn) {
        navigate({ to: "/logowanie" });
        return;
      }
      action();
    },
  };
}
