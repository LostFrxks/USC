import { Redirect, Stack } from "expo-router";
import { useSession } from "@/session/SessionProvider";
import { LoadingScreen } from "@/ui/LoadingScreen";

export default function AppLayout() {
  const { state } = useSession();

  if (state === "booting") {
    return <LoadingScreen text="Loading workspace..." />;
  }

  if (state === "anonymous") {
    return <Redirect href="/(auth)/login" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
