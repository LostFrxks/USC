import { useState } from "react";
import { router } from "expo-router";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { useSelectedCompany } from "@/session/SelectedCompanyProvider";
import { useOnboarding } from "@/onboarding/OnboardingProvider";
import { useToast } from "@/providers/ToastProvider";
import { NotificationsAction } from "@/ui/AppHeaderAction";
import { ActionCard, ActionGrid, DataRow, HeroBanner, InsetPanel, MetaTag, SectionCard, StatGrid, StatTile } from "@/ui/BusinessUI";
import { PrimaryButton, SecondaryButton } from "@/ui/Buttons";
import { Screen } from "@/ui/Screen";
import { palette } from "@/ui/theme";

export function AboutScreen() {
  const toast = useToast();
  const onboarding = useOnboarding();
  const { appRole } = useSelectedCompany();
  const [tapCount, setTapCount] = useState(0);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const onVersionTap = () => {
    const next = tapCount + 1;
    setTapCount(next);
    if (next >= 5) setAdvancedOpen(true);
  };

  return (
    <Screen testID="screen-about" title="About USC" subtitle="Product overview and version info" headerRight={<NotificationsAction />}>
      <HeroBanner
        eyebrow="Product overview"
        title="Unity Supply Chain"
        text="USC helps businesses discover suppliers, place orders faster, and keep deliveries visible in one workflow."
        aside={<MetaTag label="Mobile" tone="primary" />}
      />

      <StatGrid>
        <StatTile label="Platform" value="Mobile" tone="neutral" />
        <StatTile label="Role" value={appRole} tone="neutral" />
        <StatTile label="Guide replay" value={onboarding.replayRequested ? "On" : "Off"} tone={onboarding.replayRequested ? "warning" : "success"} />
        <StatTile label="Advanced" value={advancedOpen ? "Open" : "Hidden"} tone="neutral" />
      </StatGrid>

      <SectionCard title="Version and scope" subtitle="Tap the version label five times to reveal advanced controls.">
        <InsetPanel tone="neutral">
          <Pressable testID="about-version" onPress={onVersionTap}>
            <Text style={styles.version}>USC | Unity Supply Chain | mobile MVP</Text>
          </Pressable>
          <DataRow
            title="Mobile scope"
            body="Buyer and supplier workflows, analytics, AI support, deliveries and workspace switching are available from the same mobile product surface."
            meta="Tap the version label five times to reveal advanced guide controls."
            trailing={<MetaTag label="Parity track" tone="primary" />}
          />
        </InsetPanel>
        <InsetPanel tone="neutral">
          <View style={styles.list}>
            <Text style={styles.point}>{`\u2022 Find and compare suppliers in one place`}</Text>
            <Text style={styles.point}>{`\u2022 Build buyer orders from mobile`}</Text>
            <Text style={styles.point}>{`\u2022 Track supplier deliveries and assignments`}</Text>
            <Text style={styles.point}>{`\u2022 Review analytics and ask AI follow-up questions`}</Text>
          </View>
        </InsetPanel>
        <Text style={styles.footnote}>This mobile app is the parity-focused USC client built alongside the existing web MVP.</Text>
      </SectionCard>

      <SectionCard title="Service center" subtitle="Jump into help, FAQ or AI support from the product overview.">
        <InsetPanel tone="neutral">
          <DataRow
            title="Support routing"
            body="Use Help for operational guidance, FAQ for self-serve answers, or AI support when the pattern is unclear."
            meta="Each entry keeps the current buyer or supplier role context."
            trailing={<MetaTag label="Service cluster" tone="accent" />}
          />
        </InsetPanel>
        <ActionGrid>
          <ActionCard testID="about-open-help" title="Open help hub" text="Jump into support workflows and operational guidance." onPress={() => router.push("/(app)/help")} />
          <ActionCard testID="about-open-faq" title="Open FAQ" text="Search common USC questions and route into the right workflow." onPress={() => router.push("/(app)/faq")} />
          <ActionCard
            testID="about-open-ai-support"
            title="Open AI support"
            text="Start a focused support conversation in the AI workspace."
            onPress={() =>
              router.push({
                pathname: "/(app)/ai",
                params: {
                  prompt:
                    appRole === "supplier"
                      ? "Summarize our supplier support state and tell me the top operational actions."
                      : "Summarize our buyer support state and tell me the top operational actions.",
                  autorun: "1",
                },
              })
            }
          />
        </ActionGrid>
      </SectionCard>

      {advancedOpen ? (
        <SectionCard testID="about-advanced" title="Advanced" subtitle="Guide replay and advanced onboarding controls.">
          <InsetPanel tone="warning">
            <View style={styles.toggleRow}>
              <View style={styles.toggleCopy}>
                <Text style={styles.body}>Replay onboarding on the next launch</Text>
                <Text style={styles.footnote}>The flag is stored for the next authenticated launch of the same user, company and role context.</Text>
              </View>
              <Switch
                testID="about-replay-onboarding"
                value={onboarding.replayRequested}
                onValueChange={(nextValue) => {
                  void onboarding.requestReplay(nextValue);
                  toast.show(nextValue ? "Onboarding replay enabled." : "Onboarding replay disabled.", "info");
                }}
              />
            </View>
          </InsetPanel>
          <PrimaryButton
            testID="about-start-guide-now"
            onPress={() => {
              void onboarding.restartNow();
              toast.show("Guide restarted.", "success");
            }}
          >
            Start guide now
          </PrimaryButton>
          <SecondaryButton onPress={() => setAdvancedOpen(false)}>Hide advanced controls</SecondaryButton>
          <Text style={styles.footnote}>"Start guide now" reopens the onboarding guide immediately in the current workspace.</Text>
        </SectionCard>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  version: {
    color: palette.primary,
    fontSize: 15,
    fontWeight: "800",
  },
  body: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  list: {
    gap: 6,
  },
  point: {
    color: palette.text,
    fontSize: 14,
    lineHeight: 20,
  },
  footnote: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  toggleCopy: {
    flex: 1,
    gap: 4,
  },
});
