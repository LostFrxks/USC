import type { PropsWithChildren } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { cardShadow, palette } from "@/ui/theme";

export function PrimaryButton({
  children,
  disabled,
  onPress,
  testID,
}: PropsWithChildren<{ disabled?: boolean; onPress?: () => void | Promise<void>; testID?: string }>) {
  return (
    <Pressable
      testID={testID}
      android_ripple={{ color: "rgba(255,255,255,0.16)" }}
      style={({ pressed }) => [
        styles.primary,
        pressed && !disabled && styles.primaryPressed,
        disabled && styles.disabled,
      ]}
      disabled={disabled}
      onPress={onPress}
    >
      <Text style={styles.primaryText}>{children}</Text>
    </Pressable>
  );
}

export function SecondaryButton({
  children,
  disabled,
  onPress,
  testID,
}: PropsWithChildren<{ disabled?: boolean; onPress?: () => void | Promise<void>; testID?: string }>) {
  return (
    <Pressable
      testID={testID}
      android_ripple={{ color: "rgba(47,102,216,0.08)" }}
      style={({ pressed }) => [
        styles.secondary,
        pressed && !disabled && styles.secondaryPressed,
        disabled && styles.disabled,
      ]}
      disabled={disabled}
      onPress={onPress}
    >
      <Text style={styles.secondaryText}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primary: {
    ...cardShadow,
    minHeight: 52,
    borderRadius: 999,
    backgroundColor: palette.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  secondary: {
    ...cardShadow,
    minHeight: 52,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  primaryPressed: {
    transform: [{ scale: 0.955 }, { translateY: 2 }],
    backgroundColor: "#214FAE",
    shadowOpacity: 0.02,
    elevation: 0,
    opacity: 0.82,
  },
  secondaryPressed: {
    transform: [{ scale: 0.96 }, { translateY: 2 }],
    backgroundColor: "#DCE9FF",
    borderColor: "#9FBCF4",
    shadowOpacity: 0.02,
    elevation: 0,
    opacity: 0.86,
  },
  disabled: {
    opacity: 0.5,
  },
  primaryText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  secondaryText: {
    color: palette.text,
    fontSize: 12,
    fontWeight: "700",
  },
});
