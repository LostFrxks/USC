import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/session/SessionProvider";
import { cardShadow, palette } from "@/ui/theme";

export function NotificationsAction() {
  const { state, services } = useSession();
  const query = useQuery({
    queryKey: ["notifications", "badge"],
    queryFn: () => services.notificationsApi.list(20),
    enabled: state === "authenticated",
    refetchInterval: state === "authenticated" ? 20_000 : false,
  });

  const count = query.data?.unreadCount ?? 0;

  return (
    <Pressable
      testID="header-open-notifications"
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      onPress={() => router.push("/(app)/notifications")}
    >
      <Text style={styles.text}>Inbox</Text>
      {count > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 9 ? "9+" : count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    ...cardShadow,
    minWidth: 76,
    height: 44,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  pressed: {
    transform: [{ scale: 0.985 }],
  },
  text: {
    color: palette.text,
    fontSize: 13,
    fontWeight: "700",
  },
  badge: {
    position: "absolute",
    top: -5,
    right: -5,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: palette.accent,
    borderWidth: 2,
    borderColor: palette.surface,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
});
