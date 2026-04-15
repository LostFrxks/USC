import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSelectedCompany } from "@/session/SelectedCompanyProvider";
import { useSession } from "@/session/SessionProvider";
import { NotificationsAction } from "@/ui/AppHeaderAction";
import { ActionCard, ActionGrid, DataRow, DataStack, HeroBanner, InsetPanel, MetaTag, SectionCard, StatGrid, StatTile } from "@/ui/BusinessUI";
import { EmptyState } from "@/ui/EmptyState";
import { PrimaryButton, SecondaryButton } from "@/ui/Buttons";
import { Screen } from "@/ui/Screen";
import { palette } from "@/ui/theme";

function workspaceTone(companyType?: string | null) {
  const normalized = String(companyType ?? "").toUpperCase();
  if (normalized === "BUYER") return "primary" as const;
  if (normalized === "SUPPLIER") return "accent" as const;
  return "neutral" as const;
}

export function ProfileScreen() {
  const { profile, logout, logoutAll } = useSession();
  const { activeCompany, appRole, companies } = useSelectedCompany();

  return (
    <Screen testID="screen-profile" title="Profile" subtitle="Identity, active company and current mobile mode" headerRight={<NotificationsAction />}>
      {!profile ? (
        <EmptyState title="No profile" text="The active session does not have a loaded profile." />
      ) : (
        <>
          <HeroBanner
            eyebrow="Identity"
            title={`${profile.firstName} ${profile.lastName}`.trim() || profile.email}
            text={`${profile.email} | ${profile.phone || "No phone attached"} | mode ${appRole}`}
            aside={<MetaTag label={profile.isCourierEnabled ? "Courier enabled" : "Courier disabled"} tone={profile.isCourierEnabled ? "success" : "neutral"} />}
          />

          <StatGrid>
            <StatTile label="Workspaces" value={companies.length} />
            <StatTile label="Mode" value={appRole} tone="neutral" />
            <StatTile label="Courier" value={profile.isCourierEnabled ? "Enabled" : "Disabled"} tone={profile.isCourierEnabled ? "success" : "warning"} />
            <StatTile label="Current" value={activeCompany?.name ?? "None"} tone="neutral" />
          </StatGrid>

          <SectionCard title="Active company" subtitle="This workspace defines the current buyer or supplier context.">
            {activeCompany ? (
              <InsetPanel tone={workspaceTone(activeCompany.companyType)}>
                <DataStack>
                  <DataRow
                    title={activeCompany.name}
                    body={activeCompany.address || activeCompany.phone || "No company details yet"}
                    meta={`Type ${activeCompany.companyType || "Company"} | Courier ${profile.isCourierEnabled ? "Enabled" : "Disabled"}`}
                    trailing={<MetaTag label={activeCompany.companyType || "Company"} tone={workspaceTone(activeCompany.companyType)} />}
                  />
                </DataStack>
              </InsetPanel>
            ) : (
              <Text style={styles.meta}>No company selected.</Text>
            )}
            <ActionGrid>
              <ActionCard
                testID="profile-switch-company"
                title="Switch workspace"
                text="Open the company switcher and move into another buyer or supplier workspace."
                onPress={() => router.push("/(app)/company-picker")}
              />
              <ActionCard
                testID="profile-edit-open"
                title="Edit profile"
                text="Update user details, courier availability and active company contact data."
                onPress={() => router.push("/(app)/profile-edit")}
              />
            </ActionGrid>
          </SectionCard>

          <SectionCard title="Available companies" subtitle="All company memberships available to this account.">
            <DataStack>
              {companies.map((company) => (
                <InsetPanel key={company.companyId} tone={company.companyId === activeCompany?.companyId ? "primary" : workspaceTone(company.companyType)}>
                  <DataRow
                    title={company.name}
                    body={company.address || company.phone || "Workspace"}
                    meta={`ID ${company.companyId}${company.role ? ` | ${company.role}` : ""}`}
                    trailing={
                      <MetaTag
                        label={company.companyId === activeCompany?.companyId ? "Current" : company.companyType || "Company"}
                        tone={company.companyId === activeCompany?.companyId ? "success" : workspaceTone(company.companyType)}
                      />
                    }
                  />
                </InsetPanel>
              ))}
            </DataStack>
          </SectionCard>

          <SectionCard title="Support and product info" subtitle="Jump into help, service center or product reference screens.">
            <ActionGrid>
              <ActionCard
                testID="profile-open-about"
                title="About USC"
                text="Product summary, onboarding replay and service shortcuts."
                onPress={() => router.push("/(app)/about")}
              />
              <ActionCard
                testID="profile-open-help"
                title="Help"
                text="Operational support hub with workflow shortcuts and AI handoff."
                onPress={() => router.push("/(app)/help")}
              />
              <ActionCard
                testID="profile-open-faq"
                title="FAQ"
                text="Search common answers and jump into the right workspace flow."
                onPress={() => router.push("/(app)/faq")}
              />
            </ActionGrid>
          </SectionCard>

          <SectionCard title="Session actions" subtitle="Leave the current device or revoke sessions everywhere.">
            <PrimaryButton testID="profile-logout" onPress={logout}>Logout</PrimaryButton>
            <SecondaryButton testID="profile-logout-all" onPress={logoutAll}>Logout all devices</SecondaryButton>
          </SectionCard>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  meta: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18,
  },
});
