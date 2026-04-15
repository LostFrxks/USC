import type { PropsWithChildren } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryProvider } from "@/providers/QueryProvider";
import { ToastProvider } from "@/providers/ToastProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { SessionProvider } from "@/session/SessionProvider";
import { SelectedCompanyProvider } from "@/session/SelectedCompanyProvider";
import { CartProvider } from "@/session/CartProvider";
import { AppLifecycleProvider } from "@/providers/AppLifecycleProvider";
import { OnboardingProvider } from "@/onboarding/OnboardingProvider";

export function RootProviders({ children }: PropsWithChildren) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <QueryProvider>
            <ToastProvider>
              <SessionProvider>
                <SelectedCompanyProvider>
                  <CartProvider>
                    <OnboardingProvider>
                      <AppLifecycleProvider>{children}</AppLifecycleProvider>
                    </OnboardingProvider>
                  </CartProvider>
                </SelectedCompanyProvider>
              </SessionProvider>
            </ToastProvider>
          </QueryProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
