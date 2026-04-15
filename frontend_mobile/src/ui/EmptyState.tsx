import { StyleSheet, Text, View } from "react-native";
import { cardShadow, palette } from "@/ui/theme";

export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>Workspace state</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...cardShadow,
    borderRadius: 24,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 20,
    gap: 8,
  },
  eyebrow: {
    color: palette.primary,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: palette.text,
  },
  text: {
    fontSize: 14,
    lineHeight: 21,
    color: palette.muted,
  },
});
