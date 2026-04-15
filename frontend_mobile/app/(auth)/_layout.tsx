import { Redirect, Stack } from "expo-router";
import { useSession } from "@/session/SessionProvider";

export default function AuthLayout() {
  const { state } = useSession();

  if (state === "authenticated") {
    return <Redirect href="/" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
