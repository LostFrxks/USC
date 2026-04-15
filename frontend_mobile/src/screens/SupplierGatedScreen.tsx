import { router } from "expo-router";
import { ActionCard, ActionGrid, HeroBanner, InsetPanel, MetaTag, SectionCard, StatGrid, StatTile } from "@/ui/BusinessUI";
import { Screen } from "@/ui/Screen";
import { SecondaryButton } from "@/ui/Buttons";

export function SupplierGatedScreen() {
  return (
    <Screen title="No company context" subtitle="The app could not resolve any company membership for the current account.">
      <HeroBanner
        eyebrow="Workspace access"
        title="No companies assigned"
        text="This account does not currently expose any company memberships for buyer or supplier workspaces."
        aside={<MetaTag label="Access blocked" tone="warning" />}
      />
      <StatGrid>
        <StatTile label="Buyer mode" value="Unavailable" tone="warning" />
        <StatTile label="Supplier mode" value="Unavailable" tone="warning" />
        <StatTile label="Workspaces" value="0" tone="neutral" />
        <StatTile label="Action" value="Re-auth" tone="neutral" />
      </StatGrid>
      <SectionCard title="Next step" subtitle="Use another account or return after a company membership is assigned.">
        <InsetPanel tone="neutral">
          <ActionGrid>
            <ActionCard
              title="Why this happens"
              text="USC could not resolve any buyer or supplier memberships for the signed-in account, so workspace mode cannot start."
            />
          </ActionGrid>
        </InsetPanel>
        <SecondaryButton onPress={() => router.replace("/(auth)/login")}>Back to login</SecondaryButton>
      </SectionCard>
    </Screen>
  );
}
