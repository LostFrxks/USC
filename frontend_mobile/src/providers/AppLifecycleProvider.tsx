import { useEffect, type PropsWithChildren } from "react";
import { AppState } from "react-native";
import { queryClient } from "@/providers/QueryProvider";
import { useSession } from "@/session/SessionProvider";

export function AppLifecycleProvider({ children }: PropsWithChildren) {
  const { state, refreshProfile } = useSession();

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") return;
      if (state === "authenticated") {
        void refreshProfile();
      }
      void queryClient.invalidateQueries();
    });
    return () => subscription.remove();
  }, [refreshProfile, state]);

  return children;
}
