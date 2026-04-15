import type { PropsWithChildren, ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { cardShadow, palette } from "@/ui/theme";

export function SheetFrame({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
  testID,
}: PropsWithChildren<{ eyebrow?: string; title: string; subtitle?: string; footer?: ReactNode; testID?: string }>) {
  return (
    <View testID={testID} style={styles.sheet}>
      <View style={styles.handle} />
      <View style={styles.header}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.body}>{children}</View>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    ...cardShadow,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
  },
  handle: {
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 2,
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: palette.border,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 6,
  },
  eyebrow: {
    color: palette.primary,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  title: {
    color: palette.text,
    fontSize: 22,
    fontWeight: "800",
  },
  subtitle: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  body: {
    paddingTop: 12,
  },
  footer: {
    padding: 16,
    gap: 12,
    backgroundColor: palette.bg,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
});
