import type { PropsWithChildren, ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { cardShadow, palette } from "@/ui/theme";

export function Screen({
  title,
  subtitle,
  headerRight,
  scroll = true,
  testID,
  children,
}: PropsWithChildren<{ title: string; subtitle?: string; headerRight?: ReactNode; scroll?: boolean; testID?: string }>) {
  const body = scroll ? (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : (
    <View style={styles.fill}>{children}</View>
  );

  return (
    <SafeAreaView style={styles.safeArea} testID={testID}>
      <View pointerEvents="none" style={styles.ambient}>
        <View style={styles.ambientBlobPrimary} />
        <View style={styles.ambientBlobWarm} />
        <View style={styles.ambientBand} />
      </View>
      <View style={styles.headerShell}>
        <View style={styles.header}>
          <View style={styles.headerAccent} />
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>USC Workspace</Text>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {headerRight}
        </View>
      </View>
      {body}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.bg,
    overflow: "hidden",
  },
  ambient: {
    ...StyleSheet.absoluteFillObject,
  },
  ambientBlobPrimary: {
    position: "absolute",
    top: -140,
    left: "32%",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "#4C7EFF",
    opacity: 0.16,
  },
  ambientBlobWarm: {
    position: "absolute",
    top: 60,
    right: -90,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "#00C2FF",
    opacity: 0.12,
  },
  ambientBand: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 260,
    backgroundColor: "#061937",
    opacity: 0.92,
  },
  fill: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    paddingTop: 4,
    gap: 16,
  },
  headerShell: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
  },
  header: {
    ...cardShadow,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E4EBF8",
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  headerAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: "#2F66D8",
  },
  headerCopy: {
    flex: 1,
    gap: 6,
    paddingTop: 4,
  },
  eyebrow: {
    color: palette.primary,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  title: {
    fontSize: 27,
    fontWeight: "800",
    color: palette.text,
  },
  subtitle: {
    fontSize: 14,
    color: palette.muted,
    lineHeight: 20,
  },
});
