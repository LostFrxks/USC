import { useMemo, useState } from "react";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSelectedCompany } from "@/session/SelectedCompanyProvider";
import { NotificationsAction } from "@/ui/AppHeaderAction";
import { DataRow, FilterChip, FilterRow, HeroBanner, InsetPanel, MetaTag, SectionCard, StatGrid, StatTile } from "@/ui/BusinessUI";
import { PrimaryButton, SecondaryButton } from "@/ui/Buttons";
import { Screen } from "@/ui/Screen";
import { TextField } from "@/ui/TextField";
import { buildServiceAiPrompt, filterServiceFaq, SERVICE_FAQ, type ServiceFaqCategory } from "@/screens/serviceCenter";
import { palette } from "@/ui/theme";

export function FaqScreen() {
  const { appRole } = useSelectedCompany();
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ServiceFaqCategory>("all");
  const items = useMemo(() => filterServiceFaq(SERVICE_FAQ, query, category), [category, query]);

  return (
    <Screen testID="screen-faq" title="FAQ" subtitle="Common USC questions" headerRight={<NotificationsAction />}>
      <HeroBanner
        eyebrow="FAQ"
        title="Self-serve answers"
        text="Search common USC questions, then jump into the right workflow or continue in AI."
        aside={<MetaTag label={category} tone="primary" />}
      />

      <StatGrid>
        <StatTile label="All answers" value={SERVICE_FAQ.length} />
        <StatTile label="Visible" value={items.length} tone="neutral" />
        <StatTile label="Category" value={category} tone="neutral" />
        <StatTile label="Role" value={appRole} tone="neutral" />
      </StatGrid>

      <SectionCard title="FAQ search" subtitle="Search by workflow or product topic.">
        <TextField testID="faq-search" label="Search FAQ" value={query} onChangeText={setQuery} />
        <FilterRow>
          {(["all", "orders", "payments", "suppliers", "analytics"] as const).map((item) => (
            <FilterChip testID={`faq-filter-${item}`} key={item} active={category === item} onPress={() => setCategory(item)}>
              {item}
            </FilterChip>
          ))}
        </FilterRow>
        <InsetPanel tone="neutral">
          <DataRow
            title="Current result set"
            body={`${items.length} answers match the active search and category.`}
            meta="Open an answer, then route directly into workflow or continue in AI."
            trailing={<MetaTag label={query.trim() ? "Filtered" : "All"} tone="primary" />}
          />
        </InsetPanel>
      </SectionCard>

      <SectionCard title="Answers" subtitle="Open the workflow directly or continue with AI.">
        <View style={styles.list}>
        {items.map((item, index) => {
          const open = openIndex === index;
          return (
            <InsetPanel key={item.id} tone={open ? "primary" : "neutral"}>
              <Pressable testID={`faq-item-${index}`} onPress={() => setOpenIndex(open ? null : index)}>
                <View style={styles.questionHead}>
                  <Text style={styles.question}>{item.question}</Text>
                  <MetaTag label={item.category} tone="neutral" />
                </View>
              </Pressable>
              {open ? (
                <>
                  <Text style={styles.answer}>{item.answer}</Text>
                  <View style={styles.actions}>
                    <SecondaryButton
                      testID={`faq-ai-${item.id}`}
                      onPress={() =>
                        router.push({
                          pathname: "/(app)/ai",
                          params: {
                            prompt: buildServiceAiPrompt(appRole, item),
                            autorun: "1",
                          },
                        })
                      }
                    >
                      Ask AI
                    </SecondaryButton>
                    {item.route ? (
                      <PrimaryButton testID={`faq-route-${item.id}`} onPress={() => router.push(item.route as never)}>
                        Open workflow
                      </PrimaryButton>
                    ) : null}
                  </View>
                </>
              ) : null}
            </InsetPanel>
          );
        })}
        </View>
      </SectionCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 12,
  },
  card: {
    borderRadius: 22,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 16,
    gap: 10,
  },
  question: {
    flex: 1,
    color: palette.text,
    fontSize: 15,
    fontWeight: "800",
  },
  questionHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  answer: {
    color: palette.muted,
    lineHeight: 20,
    fontSize: 14,
  },
  actions: {
    gap: 10,
  },
});
