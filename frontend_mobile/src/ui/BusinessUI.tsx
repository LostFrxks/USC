import type { PropsWithChildren, ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { cardShadow, palette } from "@/ui/theme";

export type Tone = "primary" | "neutral" | "warning" | "danger" | "success" | "accent";
type MessageTone = "assistant" | "user";

function toneColors(tone: Tone) {
  switch (tone) {
    case "primary":
      return {
        bg: palette.primarySoft,
        border: palette.border,
        text: palette.primary,
      };
    case "warning":
      return {
        bg: "#FDECCF",
        border: "#E6C28A",
        text: "#9A5A00",
      };
    case "danger":
      return {
        bg: palette.dangerSoft,
        border: "#E6B7AD",
        text: palette.danger,
      };
    case "success":
      return {
        bg: "#E3F5E8",
        border: "#A9D7B5",
        text: "#2E8B57",
      };
    case "accent":
      return {
        bg: "#F5E6CF",
        border: "#DEBF8E",
        text: "#B7791F",
      };
    default:
      return {
        bg: palette.surface,
        border: palette.border,
        text: palette.text,
      };
  }
}

export function HeroBanner({
  eyebrow,
  title,
  text,
  aside,
  testID,
}: {
  eyebrow?: string;
  title: string;
  text: string;
  aside?: ReactNode;
  testID?: string;
}) {
  return (
    <View testID={testID} style={styles.hero}>
      <View style={styles.heroCopy}>
        {eyebrow ? <Text style={styles.heroEyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.heroTitle}>{title}</Text>
        <Text style={styles.heroText}>{text}</Text>
      </View>
      {aside ? <View style={styles.heroAside}>{aside}</View> : null}
    </View>
  );
}

export function SectionCard({
  title,
  subtitle,
  children,
  testID,
}: PropsWithChildren<{ title?: string; subtitle?: string; testID?: string }>) {
  return (
    <View testID={testID} style={styles.card}>
      {title ? (
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>{title}</Text>
          {subtitle ? <Text style={styles.cardSubtitle}>{subtitle}</Text> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function StatGrid({ children }: PropsWithChildren) {
  return <View style={styles.statsGrid}>{children}</View>;
}

export function StatTile({
  label,
  value,
  tone = "primary",
  testID,
}: {
  label: string;
  value: string | number;
  tone?: Tone;
  testID?: string;
}) {
  const colors = toneColors(tone);
  return (
    <View testID={testID} style={[styles.statTile, { backgroundColor: colors.bg, borderColor: colors.border }]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

export function FilterChip({
  children,
  active = false,
  onPress,
  testID,
}: PropsWithChildren<{ active?: boolean; onPress?: () => void; testID?: string }>) {
  return (
    <Pressable testID={testID} style={[styles.filterChip, active && styles.filterChipActive]} onPress={onPress}>
      <Text style={[styles.filterText, active && styles.filterTextActive]}>{children}</Text>
    </Pressable>
  );
}

export function FilterRow({ children }: PropsWithChildren) {
  return <View style={styles.filterRow}>{children}</View>;
}

export function MetaTag({
  label,
  tone = "neutral",
  testID,
}: {
  label: string;
  tone?: Tone;
  testID?: string;
}) {
  const colors = toneColors(tone);
  return (
    <View testID={testID} style={[styles.metaTag, { backgroundColor: colors.bg, borderColor: colors.border }]}>
      <Text style={[styles.metaTagText, { color: colors.text }]}>{label}</Text>
    </View>
  );
}

export function ActionGrid({ children }: PropsWithChildren) {
  return <View style={styles.actionGrid}>{children}</View>;
}

export function InsetPanel({
  children,
  tone = "neutral",
  testID,
}: PropsWithChildren<{ tone?: Tone; testID?: string }>) {
  const colors = toneColors(tone);
  return (
    <View
      testID={testID}
      style={[
        styles.insetPanel,
        {
          backgroundColor: colors.bg,
          borderColor: colors.border,
        },
      ]}
    >
      {children}
    </View>
  );
}

export function ActionCard({
  title,
  text,
  onPress,
  testID,
}: {
  title: string;
  text: string;
  onPress?: () => void;
  testID?: string;
}) {
  return (
    <Pressable testID={testID} style={({ pressed }) => [styles.actionCard, pressed && styles.actionCardPressed]} onPress={onPress}>
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionText}>{text}</Text>
    </Pressable>
  );
}

export function DataStack({ children }: PropsWithChildren) {
  return <View style={styles.dataStack}>{children}</View>;
}

export function MessageStack({ children, testID }: PropsWithChildren<{ testID?: string }>) {
  return <View testID={testID} style={styles.messageStack}>{children}</View>;
}

export function MessageBubble({
  tone,
  eyebrow,
  body,
  children,
  testID,
}: PropsWithChildren<{ tone: MessageTone; eyebrow: string; body: string; testID?: string }>) {
  return (
    <View testID={testID} style={[styles.messageBubble, tone === "assistant" ? styles.messageAssistant : styles.messageUser]}>
      <Text style={[styles.messageEyebrow, tone === "assistant" ? styles.messageEyebrowAssistant : styles.messageEyebrowUser]}>{eyebrow}</Text>
      <Text style={styles.messageBody}>{body}</Text>
      {children}
    </View>
  );
}

export function DataRow({
  title,
  body,
  meta,
  trailing,
  testID,
}: {
  title: string;
  body?: string;
  meta?: string;
  trailing?: ReactNode;
  testID?: string;
}) {
  return (
    <View testID={testID} style={styles.dataRow}>
      <View style={styles.dataRowHead}>
        <Text style={styles.dataRowTitle}>{title}</Text>
        {trailing}
      </View>
      {body ? <Text style={styles.dataRowBody}>{body}</Text> : null}
      {meta ? <Text style={styles.dataRowMeta}>{meta}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    ...cardShadow,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    padding: 18,
    gap: 12,
  },
  heroCopy: {
    gap: 8,
  },
  heroAside: {
    alignSelf: "flex-start",
  },
  heroEyebrow: {
    color: palette.primary,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  heroTitle: {
    color: palette.text,
    fontSize: 22,
    fontWeight: "800",
  },
  heroText: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    ...cardShadow,
    borderRadius: 22,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 16,
    gap: 12,
  },
  cardHead: {
    gap: 4,
  },
  cardTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: "800",
  },
  cardSubtitle: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statTile: {
    flexBasis: "47%",
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    gap: 6,
  },
  statLabel: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "800",
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  filterChip: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  filterChipActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  filterText: {
    color: palette.text,
    fontSize: 12,
    fontWeight: "700",
  },
  filterTextActive: {
    color: "#FFFFFF",
  },
  metaTag: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  metaTagText: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  actionGrid: {
    gap: 10,
  },
  insetPanel: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  actionCard: {
    ...cardShadow,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    padding: 16,
    gap: 6,
  },
  actionCardPressed: {
    transform: [{ scale: 0.99 }],
  },
  actionTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: "800",
  },
  actionText: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  dataStack: {
    gap: 10,
  },
  messageStack: {
    gap: 10,
  },
  messageBubble: {
    borderRadius: 18,
    padding: 12,
    gap: 8,
  },
  messageAssistant: {
    backgroundColor: palette.bg,
    borderWidth: 1,
    borderColor: palette.border,
  },
  messageUser: {
    backgroundColor: palette.primarySoft,
  },
  messageEyebrow: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  messageEyebrowAssistant: {
    color: palette.primary,
  },
  messageEyebrowUser: {
    color: palette.text,
  },
  messageBody: {
    color: palette.text,
    fontSize: 14,
    lineHeight: 20,
  },
  dataRow: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.bg,
    padding: 12,
    gap: 6,
  },
  dataRowHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  dataRowTitle: {
    flex: 1,
    color: palette.text,
    fontSize: 15,
    fontWeight: "700",
  },
  dataRowBody: {
    color: palette.text,
    fontSize: 14,
    lineHeight: 20,
  },
  dataRowMeta: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 18,
  },
});
