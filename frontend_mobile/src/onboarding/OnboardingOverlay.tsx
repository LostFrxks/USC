import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { MobileOnboardingStep } from "@/onboarding/types";
import { palette } from "@/ui/theme";

function accentColor(accent: MobileOnboardingStep["accent"]) {
  switch (accent) {
    case "action":
      return palette.accent;
    case "insight":
      return "#3366CC";
    case "success":
      return palette.primary;
    default:
      return palette.primary;
  }
}

export function OnboardingOverlay({
  visible,
  step,
  stepIndex,
  totalSteps,
  onBack,
  onNext,
  onSkip,
  onFinish,
}: {
  visible: boolean;
  step: MobileOnboardingStep | null;
  stepIndex: number;
  totalSteps: number;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
  onFinish: () => void;
}) {
  if (!visible || !step) return null;
  const isLast = stepIndex >= totalSteps - 1;

  return (
    <Modal transparent visible animationType="fade">
      <View testID="onboarding-overlay" style={styles.backdrop}>
        <View style={[styles.card, { borderColor: accentColor(step.accent) }]}>
          <Text testID="onboarding-progress" style={styles.progress}>{`${stepIndex + 1}/${totalSteps}`}</Text>
          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.body}>{step.description}</Text>
          <Text style={styles.route}>{`Route: ${step.route}`}</Text>
          <View style={styles.actions}>
            {stepIndex > 0 ? (
              <Pressable testID="onboarding-back" style={styles.ghostButton} onPress={onBack}>
                <Text style={styles.ghostText}>Back</Text>
              </Pressable>
            ) : (
              <View />
            )}
            <Pressable testID="onboarding-skip" style={styles.ghostButton} onPress={onSkip}>
              <Text style={styles.ghostText}>Skip</Text>
            </Pressable>
            <Pressable testID="onboarding-next" style={styles.primaryButton} onPress={isLast ? onFinish : onNext}>
              <Text style={styles.primaryText}>{isLast ? "Finish" : "Next"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "#00000088",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    borderRadius: 24,
    borderWidth: 2,
    backgroundColor: palette.surface,
    padding: 18,
    gap: 12,
  },
  progress: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "800",
  },
  title: {
    color: palette.text,
    fontSize: 22,
    fontWeight: "800",
  },
  body: {
    color: palette.text,
    fontSize: 15,
    lineHeight: 22,
  },
  route: {
    color: palette.muted,
    fontSize: 12,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  ghostButton: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.bg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    minWidth: 84,
  },
  ghostText: {
    color: palette.text,
    fontWeight: "700",
  },
  primaryButton: {
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: palette.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    minWidth: 92,
  },
  primaryText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
});
