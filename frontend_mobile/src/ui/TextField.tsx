import type { ReactNode } from "react";
import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { cardShadow, palette } from "@/ui/theme";

export function TextField({
  label,
  error,
  right,
  variant = "default",
  testID,
  ...props
}: TextInputProps & { label: string; error?: string; right?: ReactNode; variant?: "default" | "auth"; testID?: string }) {
  return (
    <View style={styles.wrapper}>
      <Text style={[styles.label, variant === "auth" && styles.labelAuth]}>{label}</Text>
      <View style={[styles.field, variant === "auth" && styles.fieldAuth]}>
        <TextInput
          testID={testID}
          style={[styles.input, variant === "auth" && styles.inputAuth]}
          placeholderTextColor={palette.muted}
          {...props}
        />
        {right}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 8,
  },
  label: {
    fontSize: 11,
    color: palette.primary,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  labelAuth: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "none",
    letterSpacing: 0,
    color: palette.muted,
  },
  field: {
    ...cardShadow,
    minHeight: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  fieldAuth: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 0,
    backgroundColor: "#F8FAFC",
    shadowOpacity: 0,
    elevation: 0,
  },
  input: {
    flex: 1,
    minHeight: 54,
    color: palette.text,
    fontSize: 15,
  },
  inputAuth: {
    minHeight: 48,
    fontSize: 14,
  },
  error: {
    color: palette.danger,
    fontSize: 12,
    fontWeight: "500",
  },
});
