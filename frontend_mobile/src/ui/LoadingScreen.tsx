import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { cardShadow, palette } from "@/ui/theme";

export function LoadingScreen({ text = "Loading USC Mobile..." }: { text?: string }) {
  return (
    <View style={styles.root}>
      <View style={styles.panel}>
        <Text style={styles.eyebrow}>USC Workspace</Text>
        <ActivityIndicator size="large" color={palette.primary} />
        <Text style={styles.text}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.bg,
    gap: 12,
  },
  panel: {
    ...cardShadow,
    minWidth: 220,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: "center",
    gap: 12,
  },
  eyebrow: {
    color: palette.primary,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  text: {
    color: palette.muted,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
});
