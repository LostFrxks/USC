import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSelectedCompany } from "@/session/SelectedCompanyProvider";
import { DataRow, DataStack, HeroBanner, InsetPanel, MetaTag, SectionCard, StatGrid, StatTile } from "@/ui/BusinessUI";
import { PrimaryButton, SecondaryButton } from "@/ui/Buttons";
import { Screen } from "@/ui/Screen";
import { EmptyState } from "@/ui/EmptyState";
import { TextField } from "@/ui/TextField";
import { filterWorkspaceCompanies, groupWorkspaceCompanies, workspaceStats } from "@/screens/companyWorkspace";
import { palette } from "@/ui/theme";

function workspaceTone(companyType?: string | null) {
  const normalized = String(companyType ?? "").toUpperCase();
  if (normalized === "BUYER") return "primary" as const;
  if (normalized === "SUPPLIER") return "accent" as const;
  return "neutral" as const;
}

export function CompanyPickerScreen() {
  const { companies, activeCompany, activeCompanyId, setActiveCompanyId } = useSelectedCompany();
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => filterWorkspaceCompanies(companies, query), [companies, query]);
  const sections = useMemo(() => groupWorkspaceCompanies(filtered, activeCompanyId), [filtered, activeCompanyId]);
  const stats = useMemo(() => workspaceStats(companies), [companies]);

  return (
    <Screen testID="screen-company-picker" title="Choose active company" subtitle="Company type defines whether the app works in buyer or supplier mode.">
      {companies.length === 0 ? (
        <EmptyState title="No companies available" text="The mobile client needs at least one company membership to continue." />
      ) : (
        <View style={styles.stack}>
          <HeroBanner
            eyebrow="Workspace switcher"
            title={activeCompany?.name ?? "Choose a workspace"}
            text="Switch between buyer and supplier companies without leaving the mobile workspace flow."
            aside={<MetaTag label={activeCompany?.companyType || "No current"} tone={activeCompany ? workspaceTone(activeCompany.companyType) : "neutral"} />}
          />

          <StatGrid>
            <StatTile label="All" value={stats.all} />
            <StatTile label="Buyer" value={stats.buyer} />
            <StatTile label="Supplier" value={stats.supplier} />
            <StatTile label="Current" value={activeCompany?.name ?? "None"} tone="neutral" />
          </StatGrid>

          <SectionCard title="Workspace controls" subtitle="Search by company name, type, address or role and then jump into the right workspace.">
            <TextField testID="company-search" label="Search workspaces" value={query} onChangeText={setQuery} />
            <InsetPanel tone="neutral">
              <DataRow
                title="Current result set"
                body={`${filtered.length} of ${companies.length} workspaces match the active search.`}
                meta={`Buyer ${stats.buyer} | Supplier ${stats.supplier}`}
                trailing={<MetaTag label={query.trim() ? "Filtered" : "All"} tone="primary" />}
              />
            </InsetPanel>
          </SectionCard>

          {activeCompany ? (
            <SectionCard title="Current workspace" subtitle="Keep working here or switch into another buyer or supplier workspace.">
              <InsetPanel tone={workspaceTone(activeCompany.companyType)}>
                <DataStack>
                  <DataRow
                    title={activeCompany.name}
                    body={activeCompany.address || activeCompany.phone || "Workspace"}
                    meta={`ID ${activeCompany.companyId}${activeCompany.role ? ` | ${activeCompany.role}` : ""}`}
                    trailing={<MetaTag label={activeCompany.companyType || "Company"} tone={workspaceTone(activeCompany.companyType)} />}
                  />
                </DataStack>
              </InsetPanel>
              <PrimaryButton testID="company-continue-current" onPress={() => router.replace("/")}>
                Continue with current workspace
              </PrimaryButton>
            </SectionCard>
          ) : null}

          {sections.length === 0 ? (
            <EmptyState title="No workspaces match this search" text="Try another company name, phone, address, or type." />
          ) : (
            sections.map((section) => (
              <SectionCard
                key={section.key}
                title={`${section.title} (${section.count})`}
                subtitle={section.key === "buyer" ? "Use these workspaces for buyer flows, sourcing and order management." : section.key === "supplier" ? "Use these workspaces for supplier flows, deliveries and SKU management." : "Additional memberships available in this account."}
              >
                <View style={styles.list}>
                  {section.items.map((company) => (
                    <InsetPanel key={company.companyId} tone={activeCompanyId === company.companyId ? "primary" : workspaceTone(company.companyType)}>
                      <Pressable
                        testID={`company-option-${company.companyId}`}
                        style={styles.cardTap}
                        onPress={async () => {
                          await setActiveCompanyId(company.companyId);
                          router.replace("/");
                        }}
                      >
                        <View style={styles.cardHead}>
                          <Text style={styles.title}>{company.name}</Text>
                          <MetaTag
                            label={activeCompanyId === company.companyId ? "Current" : company.companyType || "Company"}
                            tone={activeCompanyId === company.companyId ? "success" : workspaceTone(company.companyType)}
                          />
                        </View>
                        <Text style={styles.meta}>{company.address || company.phone || "Workspace"}</Text>
                        <Text style={styles.footnote}>{`ID ${company.companyId}${company.role ? ` | ${company.role}` : ""}`}</Text>
                      </Pressable>
                      {activeCompanyId === company.companyId ? (
                        <SecondaryButton>Current workspace</SecondaryButton>
                      ) : (
                        <PrimaryButton
                          testID={`company-switch-${company.companyId}`}
                          onPress={async () => {
                            await setActiveCompanyId(company.companyId);
                            router.replace("/");
                          }}
                        >
                          Switch workspace
                        </PrimaryButton>
                      )}
                    </InsetPanel>
                  ))}
                </View>
              </SectionCard>
            ))
          )}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 14,
  },
  list: {
    gap: 12,
  },
  cardTap: {
    gap: 6,
  },
  cardHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
  },
  title: {
    fontSize: 17,
    fontWeight: "800",
    color: palette.text,
  },
  meta: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  footnote: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 18,
  },
});
