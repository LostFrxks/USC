import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AiChatSession, WhatIfLevers, WhatIfResponse } from "@usc/core";
import { useLocalSearchParams } from "expo-router";
import { useSelectedCompany } from "@/session/SelectedCompanyProvider";
import { useSession } from "@/session/SessionProvider";
import { useToast } from "@/providers/ToastProvider";
import { NotificationsAction } from "@/ui/AppHeaderAction";
import { ActionCard, ActionGrid, FilterChip, FilterRow, HeroBanner, InsetPanel, MessageBubble, MessageStack, MetaTag, SectionCard, StatGrid, StatTile } from "@/ui/BusinessUI";
import { PrimaryButton, SecondaryButton } from "@/ui/Buttons";
import { EmptyState } from "@/ui/EmptyState";
import { Screen } from "@/ui/Screen";
import { buildAiMonthOptions } from "@/screens/aiMonthOptions";
import { buildScenarioDecisionCards, buildScenarioHeadline, buildScenarioPressureCards } from "@/screens/aiScenarioInsights";
import { activeLeverLabels, applyLeverPreset, draftFromScenarioLevers, makeLeverDraft, type LeverDraft, type ScenarioPresetMode } from "@/screens/aiScenarioPresets";
import { buildScenarioActs, buildScenarioCascadeNodes, buildScenarioMoneyFlowCards, compactMoney } from "@/screens/aiScenarioTheater";
import { buildScenarioCompareBars, buildScenarioDrilldownBars, scenarioDeltaLabel } from "@/screens/aiVisuals";
import { TextField } from "@/ui/TextField";
import { palette } from "@/ui/theme";

const BUYER_QUICK_PROMPTS = [
  "What is driving our buyer performance this month?",
  "Which actions should we prioritize to improve delivery and reduce cancellations?",
  "Are we too concentrated on one category or supplier?",
];

const SUPPLIER_QUICK_PROMPTS = [
  "What is driving our supplier performance this month?",
  "Which SKUs or flows should we fix first?",
  "Where are we leaking revenue in the order pipeline?",
];

type StreamingState = {
  sessionId: number;
  question: string;
  assistantText: string;
};

function toNumber(value: string): number {
  const normalized = value.replace(",", ".").trim();
  const num = Number(normalized);
  return Number.isFinite(num) ? num : 0;
}

function money(value: number): string {
  return `${Math.round(value).toLocaleString("en-US")} som`;
}

function pct(value: number): string {
  return `${value.toFixed(1)}%`;
}

type ScenarioTheme = "blue" | "amber" | "green" | "gold" | "red";

function scenarioPanelTone(theme: ScenarioTheme) {
  switch (theme) {
    case "blue":
      return "primary" as const;
    case "amber":
      return "warning" as const;
    case "green":
      return "success" as const;
    case "gold":
      return "accent" as const;
    default:
      return "danger" as const;
  }
}

function scenarioRailColor(theme: ScenarioTheme) {
  switch (theme) {
    case "blue":
      return palette.primary;
    case "amber":
      return palette.accent;
    case "green":
      return "#2E8B57";
    case "gold":
      return "#B7791F";
    default:
      return palette.danger;
  }
}

function decisionPanelTone(tone: "up" | "down" | "neutral") {
  if (tone === "up") return "success" as const;
  if (tone === "down") return "danger" as const;
  return "neutral" as const;
}

function CompareSeriesBars({
  items,
}: {
  items: ReturnType<typeof buildScenarioCompareBars>;
}) {
  return (
    <View style={styles.barList}>
      {items.map((item) => (
        <View key={item.label} style={styles.barRow}>
          <View style={styles.barRowHead}>
            <Text style={styles.rowTitle}>{item.label}</Text>
            <Text style={styles.footnote}>{`${money(item.baseline)} -> ${money(item.scenario)}`}</Text>
          </View>
          <View style={styles.barTrack}>
            <View style={[styles.barFillMuted, { width: `${Math.round(item.baselineRatio * 100)}%` }]} />
          </View>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${Math.round(item.scenarioRatio * 100)}%` }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

function DrilldownBars({
  items,
}: {
  items: ReturnType<typeof buildScenarioDrilldownBars>;
}) {
  return (
    <View style={styles.barList}>
      {items.map((item) => (
        <View key={item.label} style={styles.barRow}>
          <View style={styles.barRowHead}>
            <Text style={styles.rowTitle}>{item.label}</Text>
            <Text style={styles.footnote}>{scenarioDeltaLabel(item.deltaPct, "%")}</Text>
          </View>
          <View style={styles.barTrack}>
            <View style={[styles.barFillAccent, { width: `${Math.round(item.ratio * 100)}%` }]} />
          </View>
          <Text style={styles.footnote}>{`${money(item.baseline)} -> ${money(item.scenario)}`}</Text>
        </View>
      ))}
    </View>
  );
}

export function AIScreen() {
  const params = useLocalSearchParams<{ prompt?: string; month?: string; autorun?: string }>();
  const { activeCompanyId, activeCompany, appRole } = useSelectedCompany();
  const { services } = useSession();
  const toast = useToast();
  const queryClient = useQueryClient();
  const handledHandoffRef = useRef("");
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [streaming, setStreaming] = useState<StreamingState | null>(null);
  const [whatIfLoading, setWhatIfLoading] = useState(false);
  const [leverDraft, setLeverDraft] = useState<LeverDraft>(makeLeverDraft);
  const [horizonDays, setHorizonDays] = useState<30 | 60 | 90>(30);
  const [drilldownBy, setDrilldownBy] = useState<"category" | "sku">("category");
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [whatIfResult, setWhatIfResult] = useState<WhatIfResponse | null>(null);
  const [renamingChatId, setRenamingChatId] = useState<number | null>(null);
  const [chatTitleDraft, setChatTitleDraft] = useState("");
  const [renamingScenarioId, setRenamingScenarioId] = useState<number | null>(null);
  const [scenarioTitleDraft, setScenarioTitleDraft] = useState("");
  const compareBars = useMemo(() => buildScenarioCompareBars(whatIfResult), [whatIfResult]);
  const drilldownBars = useMemo(() => buildScenarioDrilldownBars(whatIfResult), [whatIfResult]);
  const activeLevers = useMemo(() => activeLeverLabels(appRole, leverDraft), [appRole, leverDraft]);
  const scenarioHeadline = useMemo(() => buildScenarioHeadline(appRole, whatIfResult), [appRole, whatIfResult]);
  const pressureCards = useMemo(() => buildScenarioPressureCards(appRole, whatIfResult), [appRole, whatIfResult]);
  const decisionCards = useMemo(() => buildScenarioDecisionCards(appRole, whatIfResult), [appRole, whatIfResult]);
  const cascadeNodes = useMemo(() => buildScenarioCascadeNodes(appRole, whatIfResult), [appRole, whatIfResult]);
  const moneyFlowCards = useMemo(() => buildScenarioMoneyFlowCards(appRole, whatIfResult), [appRole, whatIfResult]);
  const scenarioActs = useMemo(() => buildScenarioActs(whatIfResult), [whatIfResult]);

  const chatsQuery = useQuery({
    queryKey: ["ai-chats", appRole, activeCompanyId],
    queryFn: () => services.aiChatApi.listSessions({ companyId: activeCompanyId as number, role: appRole, limit: 20, messageLimit: 80 }),
    enabled: Boolean(activeCompanyId),
  });

  const scenariosQuery = useQuery({
    queryKey: ["what-if-scenarios", appRole, activeCompanyId],
    queryFn: () => services.analyticsApi.fetchWhatIfScenarios({ companyId: activeCompanyId as number, role: appRole, limit: 20 }),
    enabled: Boolean(activeCompanyId),
  });

  const analyticsContextQuery = useQuery({
    queryKey: ["analytics", "ai-context", appRole, activeCompanyId],
    queryFn: () => services.analyticsApi.fetchSummary({ companyId: activeCompanyId as number, role: appRole, days: 365 }),
    enabled: Boolean(activeCompanyId),
  });

  const sessions = chatsQuery.data?.sessions ?? [];
  const quickPrompts = appRole === "supplier" ? SUPPLIER_QUICK_PROMPTS : BUYER_QUICK_PROMPTS;
  const monthOptions = useMemo(() => buildAiMonthOptions(analyticsContextQuery.data?.salesTrends ?? []), [analyticsContextQuery.data?.salesTrends]);
  const currentSession = useMemo<AiChatSession | null>(
    () => sessions.find((session) => session.id === selectedSessionId) ?? sessions[0] ?? null,
    [selectedSessionId, sessions]
  );

  useEffect(() => {
    if (sessions.length === 0) {
      setSelectedSessionId(null);
      return;
    }
    if (selectedSessionId && sessions.some((session) => session.id === selectedSessionId)) return;
    setSelectedSessionId(sessions[0].id);
  }, [selectedSessionId, sessions]);

  function buildLevers(): WhatIfLevers {
    if (appRole === "supplier") {
      return {
        deliveryImprovePp: toNumber(leverDraft.deliveryImprovePp),
        cancelReducePp: toNumber(leverDraft.cancelReducePp),
        promoIntensityPct: toNumber(leverDraft.promoIntensityPct),
        priceCutOverpricedPct: toNumber(leverDraft.roleSpecificA),
        pipelineRecoveryPct: toNumber(leverDraft.roleSpecificB),
      };
    }
    return {
      deliveryImprovePp: toNumber(leverDraft.deliveryImprovePp),
      cancelReducePp: toNumber(leverDraft.cancelReducePp),
      promoIntensityPct: toNumber(leverDraft.promoIntensityPct),
      cheaperSupplierShiftPct: toNumber(leverDraft.roleSpecificA),
      reliableSupplierShiftPct: toNumber(leverDraft.roleSpecificB),
    };
  }

  function applyPreset(mode: ScenarioPresetMode) {
    setLeverDraft(applyLeverPreset(appRole, mode));
  }

  async function refreshChats() {
    await queryClient.refetchQueries({ queryKey: ["ai-chats"] });
  }

  async function sendQuestion(nextQuestion: string, options?: { month?: string | null }) {
    if (!activeCompanyId) return;
    const trimmed = nextQuestion.trim();
    if (!trimmed) return;
    const questionMonth = options?.month ?? selectedMonth;

    setAsking(true);
    try {
      let chatSessionId = selectedSessionId;
      if (!chatSessionId) {
        const created = await services.aiChatApi.createSession({ companyId: activeCompanyId, role: appRole, title: trimmed });
        chatSessionId = created.id;
        setSelectedSessionId(created.id);
      }

      setStreaming({
        sessionId: chatSessionId,
        question: trimmed,
        assistantText: "",
      });

      try {
        const answer = await services.analyticsApi.streamAssistant(
          {
            companyId: activeCompanyId,
            role: appRole,
            question: trimmed,
            days: 365,
            selectedMonth: questionMonth,
            chatSessionId,
          },
          {
            onDelta: (chunk) => {
              setStreaming((current) => (current ? { ...current, assistantText: `${current.assistantText}${chunk}` } : current));
            },
          }
        );
        if (answer.chatSessionId) {
          setSelectedSessionId(answer.chatSessionId);
        }
      } catch {
        const fallback = await services.analyticsApi.queryAssistant({
          companyId: activeCompanyId,
          role: appRole,
          question: trimmed,
          days: 365,
          selectedMonth: questionMonth,
          chatSessionId,
        });
        setStreaming((current) => (current ? { ...current, assistantText: fallback.summary } : current));
        if (fallback.chatSessionId) {
          setSelectedSessionId(fallback.chatSessionId);
        }
      }

      setQuestion("");
      await refreshChats();
      setStreaming(null);
    } catch (error) {
      setStreaming(null);
      toast.show(error instanceof Error ? error.message : "AI request failed.", "error");
    } finally {
      setAsking(false);
    }
  }

  const visibleMessages = useMemo(() => {
    const base = currentSession?.messages ?? [];
    if (!streaming || !currentSession || currentSession.id !== streaming.sessionId) {
      return base;
    }
    return [
      ...base,
      {
        id: -1,
        role: "user" as const,
        text: streaming.question,
        createdAt: new Date().toISOString(),
      },
      {
        id: -2,
        role: "assistant" as const,
        text: streaming.assistantText || "Thinking...",
        createdAt: new Date().toISOString(),
      },
    ];
  }, [currentSession, streaming]);

  useEffect(() => {
    if (!activeCompanyId) return;
    const prompt = typeof params.prompt === "string" ? params.prompt.trim() : "";
    const month = typeof params.month === "string" ? params.month.trim() : "";
    const autorun = params.autorun === "1";
    const handoffKey = `${activeCompanyId}|${appRole}|${prompt}|${month}|${params.autorun ?? ""}`;
    if (!prompt || handledHandoffRef.current === handoffKey) return;

    handledHandoffRef.current = handoffKey;
    if (month) {
      setSelectedMonth(month);
    }
    if (autorun) {
      void sendQuestion(prompt, { month: month || null });
    } else {
      setQuestion(prompt);
    }
  }, [activeCompanyId, appRole, params.autorun, params.month, params.prompt]);

  return (
    <Screen
      testID="screen-ai"
      title="AI Workspace"
      subtitle={activeCompany ? `${activeCompany.name} - ${appRole}` : "Analytics chat + compact what-if"}
      headerRight={<NotificationsAction />}
    >
      {!activeCompanyId ? (
        <EmptyState title="No company selected" text="Choose an active company before opening the AI workspace." />
      ) : (
        <View style={styles.stack}>
          <HeroBanner
            eyebrow="AI workspace"
            title={activeCompany?.name ?? "AI workspace"}
            text="Move from analytics questions into scenario decisions without leaving the workspace."
            aside={<MetaTag label={selectedMonth ? `Month ${selectedMonth}` : appRole} tone="primary" />}
          />

          <StatGrid>
            <StatTile label="Chats" value={sessions.length} />
            <StatTile label="Scenarios" value={scenariosQuery.data?.items.length ?? 0} />
            <StatTile label="Horizon" value={`${horizonDays}d`} tone="neutral" />
            <StatTile label="Focus" value={selectedMonth ?? "Latest"} tone="neutral" />
          </StatGrid>

          {selectedMonth ? (
            <SectionCard testID="ai-handoff-banner" title={`Focus month ${selectedMonth}`} subtitle="The AI workspace is scoped to this month for chat prompts and what-if simulations until you switch the month chip.">
              <Text style={styles.body}>Use the month chips below to switch back to the latest mix or move into another recent month.</Text>
            </SectionCard>
          ) : null}

          <SectionCard title="Quick prompts" subtitle="Start from a focused question instead of composing from scratch.">
            <ActionGrid>
              {quickPrompts.map((prompt) => (
                <ActionCard key={prompt} title="Prompt" text={prompt} onPress={() => void sendQuestion(prompt)} />
              ))}
            </ActionGrid>
          </SectionCard>

          <SectionCard title="Chat sessions" subtitle="Persisted server-side sessions for the current company and role.">
            <ActionGrid>
              <ActionCard
                title="New chat"
                text="Open a fresh AI conversation for the current company and role."
                onPress={async () => {
                  if (!activeCompanyId) return;
                  try {
                    const created = await services.aiChatApi.createSession({ companyId: activeCompanyId, role: appRole, title: "New chat" });
                    await queryClient.invalidateQueries({ queryKey: ["ai-chats"] });
                    setSelectedSessionId(created.id);
                  } catch (error) {
                    toast.show(error instanceof Error ? error.message : "Failed to create chat session.", "error");
                  }
                }}
              />
              {sessions.map((session) => (
                <View key={session.id} style={styles.sessionRow}>
                  <View style={styles.sessionMain}>
                    <ActionCard
                      title={session.title}
                      text={currentSession?.id === session.id ? "Current session" : "Open this persisted chat session."}
                      onPress={() => setSelectedSessionId(session.id)}
                    />
                  </View>
                  <SecondaryButton
                    onPress={() => {
                      setRenamingChatId(session.id);
                      setChatTitleDraft(session.title);
                    }}
                  >
                    Rename
                  </SecondaryButton>
                  <SecondaryButton
                    onPress={() => {
                      Alert.alert("Delete chat", `Delete "${session.title}"?`, [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Delete",
                          style: "destructive",
                          onPress: async () => {
                            try {
                              await services.aiChatApi.deleteSession(session.id);
                              await queryClient.invalidateQueries({ queryKey: ["ai-chats"] });
                              if (selectedSessionId === session.id) setSelectedSessionId(null);
                            } catch (error) {
                              toast.show(error instanceof Error ? error.message : "Failed to delete chat.", "error");
                            }
                          },
                        },
                      ]);
                    }}
                  >
                    Delete
                  </SecondaryButton>
                </View>
              ))}
            </ActionGrid>
            {renamingChatId ? (
              <View style={styles.inlineEditor}>
                <Text style={styles.rowTitle}>Rename chat</Text>
                <TextField label="Chat title" value={chatTitleDraft} onChangeText={setChatTitleDraft} />
                <View style={styles.rowActions}>
                  <SecondaryButton
                    onPress={() => {
                      setRenamingChatId(null);
                      setChatTitleDraft("");
                    }}
                  >
                    Cancel
                  </SecondaryButton>
                  <PrimaryButton
                    onPress={async () => {
                      if (!chatTitleDraft.trim() || !renamingChatId) return;
                      try {
                        await services.aiChatApi.renameSession(renamingChatId, chatTitleDraft.trim());
                        await queryClient.invalidateQueries({ queryKey: ["ai-chats"] });
                        setRenamingChatId(null);
                        setChatTitleDraft("");
                        toast.show("Chat renamed.", "success");
                      } catch (error) {
                        toast.show(error instanceof Error ? error.message : "Failed to rename chat.", "error");
                      }
                    }}
                  >
                    Save title
                  </PrimaryButton>
                </View>
              </View>
            ) : null}
          </SectionCard>

          <SectionCard title="Ask AI" subtitle="Stream an answer, inspect metrics, then continue into scenario analysis.">
            <TextField testID="ai-question-input" label="Question" value={question} onChangeText={setQuestion} multiline />
            <PrimaryButton testID="ai-send-question" disabled={asking || question.trim().length === 0} onPress={() => void sendQuestion(question)}>
              {asking ? "Streaming..." : "Send question"}
            </PrimaryButton>
            {!currentSession && !streaming ? (
              <Text style={styles.body}>No chat selected yet.</Text>
            ) : visibleMessages.length === 0 ? (
              <Text style={styles.body}>This session is empty. Ask the first analytics question.</Text>
            ) : (
              <MessageStack>
                {visibleMessages.map((message) => (
                <MessageBubble key={message.id} tone={message.role === "assistant" ? "assistant" : "user"} eyebrow={message.role} body={message.text}>
                  {message.role === "assistant" && "payload" in message && message.payload ? (
                    <StatGrid>
                      <StatTile label="Confidence" value={pct(message.payload.confidence * 100)} />
                      <StatTile label="Delivery" value={pct(message.payload.metrics.deliveryRatePct)} tone="success" />
                      <StatTile label="Cancel" value={pct(message.payload.metrics.cancelRatePct)} tone="warning" />
                      <StatTile label="Top category" value={message.payload.metrics.topCategoryName || "-"} tone="neutral" />
                      {message.payload.focusMonth ? <StatTile label="Focus month" value={message.payload.focusMonth} tone="neutral" /> : null}
                    </StatGrid>
                  ) : null}
                  {message.role === "assistant" && "payload" in message && message.payload?.probableCauses?.length ? (
                    <View style={styles.messageList}>
                      {message.payload.probableCauses.map((cause, index) => (
                        <Text key={`${cause}-${index}`} style={styles.body}>{`\u2022 ${cause}`}</Text>
                      ))}
                    </View>
                  ) : null}
                  {message.role === "assistant" && "payload" in message && message.payload?.actions?.length ? (
                    <View style={styles.messageList}>
                      {message.payload.actions.map((action, index) => (
                        <Text key={`${action}-${index}`} style={styles.body}>{`\u2022 ${action}`}</Text>
                      ))}
                    </View>
                  ) : null}
                </MessageBubble>
              ))}
              </MessageStack>
            )}
          </SectionCard>

          <SectionCard title="What-if" subtitle="Tune scenario levers, compare outcomes and discuss the result in AI.">
            <View style={styles.inlineEditor}>
              <Text style={styles.rowTitle}>Scenario controls</Text>
              <FilterRow>
                <FilterChip testID="ai-month-latest" active={!selectedMonth} onPress={() => setSelectedMonth(null)}>
                  Latest mix
                </FilterChip>
                {monthOptions.map((item, index) => (
                  <FilterChip key={item.value} testID={`ai-month-${index}`} active={selectedMonth === item.value} onPress={() => setSelectedMonth(item.value)}>
                    {item.label}
                  </FilterChip>
                ))}
              </FilterRow>
              <FilterRow>
                {[30, 60, 90].map((days) => (
                  <FilterChip key={days} testID={`ai-whatif-horizon-${days}`} active={horizonDays === days} onPress={() => setHorizonDays(days as 30 | 60 | 90)}>
                    {`${days}d`}
                  </FilterChip>
                ))}
              </FilterRow>
              <FilterRow>
                {(["category", "sku"] as const).map((mode) => (
                  <FilterChip key={mode} testID={`ai-whatif-drilldown-${mode}`} active={drilldownBy === mode} onPress={() => setDrilldownBy(mode)}>
                    {mode === "category" ? "Category" : "SKU"}
                  </FilterChip>
                ))}
              </FilterRow>
              <FilterRow>
                {(["soft", "balanced", "boost"] as const).map((mode) => (
                  <FilterChip key={mode} testID={`ai-whatif-preset-${mode}`} onPress={() => applyPreset(mode)}>
                    {mode === "soft" ? "Soft pulse" : mode === "balanced" ? "Balanced play" : "Max push"}
                  </FilterChip>
                ))}
              </FilterRow>
              {activeLevers.length ? (
                <FilterRow>
                  {activeLevers.map((item) => (
                    <View key={`${item.label}-${item.value}`} style={styles.activeLeverChip}>
                      <Text style={styles.activeLeverText}>{`${item.label} ${item.value}`}</Text>
                    </View>
                  ))}
                </FilterRow>
              ) : null}
            </View>
            <TextField
              label="Delivery improve (pp)"
              value={leverDraft.deliveryImprovePp}
              onChangeText={(value) => setLeverDraft((prev) => ({ ...prev, deliveryImprovePp: value }))}
              keyboardType="decimal-pad"
            />
            <TextField
              label="Cancel reduce (pp)"
              value={leverDraft.cancelReducePp}
              onChangeText={(value) => setLeverDraft((prev) => ({ ...prev, cancelReducePp: value }))}
              keyboardType="decimal-pad"
            />
            <TextField
              label="Promo intensity (%)"
              value={leverDraft.promoIntensityPct}
              onChangeText={(value) => setLeverDraft((prev) => ({ ...prev, promoIntensityPct: value }))}
              keyboardType="decimal-pad"
            />
            <TextField
              label={appRole === "supplier" ? "Price correction (%)" : "Cheaper supplier shift (%)"}
              value={leverDraft.roleSpecificA}
              onChangeText={(value) => setLeverDraft((prev) => ({ ...prev, roleSpecificA: value }))}
              keyboardType="decimal-pad"
            />
            <TextField
              label={appRole === "supplier" ? "Pipeline recovery (%)" : "Reliable supplier shift (%)"}
              value={leverDraft.roleSpecificB}
              onChangeText={(value) => setLeverDraft((prev) => ({ ...prev, roleSpecificB: value }))}
              keyboardType="decimal-pad"
            />
            <View style={styles.rowActions}>
              <SecondaryButton onPress={() => setLeverDraft(makeLeverDraft())}>Reset</SecondaryButton>
              <PrimaryButton
                testID="ai-whatif-run"
                disabled={whatIfLoading}
                onPress={async () => {
                  if (!activeCompanyId) return;
                  setWhatIfLoading(true);
                  try {
                    const result = await services.analyticsApi.simulateWhatIf({
                      companyId: activeCompanyId,
                      role: appRole,
                      days: 365,
                      horizonDays,
                      selectedMonth,
                      drilldownBy,
                      levers: buildLevers(),
                    });
                    setWhatIfResult(result);
                  } catch (error) {
                    toast.show(error instanceof Error ? error.message : "What-if simulation failed.", "error");
                  } finally {
                    setWhatIfLoading(false);
                  }
                }}
              >
                {whatIfLoading ? "Simulating..." : "Run scenario"}
              </PrimaryButton>
              </View>
              {whatIfResult ? (
                <View style={styles.whatIfResult}>
                  <InsetPanel tone="neutral">
                    <Text style={styles.heroEyebrow}>Scenario signal</Text>
                    <Text style={styles.heroTitle}>{scenarioHeadline.title}</Text>
                    <Text style={styles.body}>{scenarioHeadline.text}</Text>
                  </InsetPanel>
                  <Text style={styles.rowTitle}>{`Revenue forecast: ${Math.round(whatIfResult.baseline.revenueForecastSom)} -> ${Math.round(whatIfResult.scenario.revenueForecastSom)} som`}</Text>
                  <Text style={styles.body}>{`Delivery: ${whatIfResult.baseline.deliveryRatePct.toFixed(1)}% -> ${whatIfResult.scenario.deliveryRatePct.toFixed(1)}%`}</Text>
                  <Text style={styles.body}>{`Cancel: ${whatIfResult.baseline.cancelRatePct.toFixed(1)}% -> ${whatIfResult.scenario.cancelRatePct.toFixed(1)}%`}</Text>
                  <Text style={styles.footnote}>{`Confidence ${pct(whatIfResult.confidence * 100)} | Month ${selectedMonth ?? whatIfResult.selectedMonth ?? "latest"} | Drilldown ${whatIfResult.drilldown.by} | Horizon ${whatIfResult.horizonDays}d`}</Text>
                  {pressureCards.length ? (
                    <View style={styles.pressureGrid}>
                      {pressureCards.map((card) => (
                        <InsetPanel key={card.label} tone={scenarioPanelTone(card.theme as ScenarioTheme)}>
                          <View style={styles.barRowHead}>
                            <Text style={styles.rowTitle}>{card.label}</Text>
                            <Text style={[styles.metricValue, { color: scenarioRailColor(card.theme as ScenarioTheme) }]}>
                              {Math.round(card.value)}
                            </Text>
                          </View>
                          <View style={styles.barTrack}>
                            <View
                              style={[
                                styles.pressureBar,
                                { backgroundColor: scenarioRailColor(card.theme as ScenarioTheme) },
                                { width: `${Math.round(card.value)}%` },
                              ]}
                            />
                          </View>
                          <Text style={styles.footnote}>{card.text}</Text>
                        </InsetPanel>
                      ))}
                    </View>
                  ) : null}
                  {cascadeNodes.length ? (
                    <InsetPanel tone="neutral">
                      <Text style={styles.rowTitle}>Impact cascade</Text>
                      <View testID="ai-whatif-cascade" style={styles.cascadeGrid}>
                        {cascadeNodes.map((node) => (
                          <InsetPanel key={node.title} tone={node.tone === "down" ? "danger" : "neutral"}>
                            <Text style={styles.heroEyebrow}>{node.eyebrow}</Text>
                            <Text style={styles.rowTitle}>{node.title}</Text>
                            <View style={styles.metricsGrid}>
                              <View style={styles.metricCard}>
                                <Text style={styles.metricLabel}>Base</Text>
                              <Text style={styles.metricValueSmall}>{node.base}</Text>
                            </View>
                            <View style={styles.metricCard}>
                              <Text style={styles.metricLabel}>Scene</Text>
                              <Text style={styles.metricValueSmall}>{node.live}</Text>
                            </View>
                          </View>
                          <Text
                            style={[
                              styles.metricValue,
                              node.tone === "down" ? styles.metricValueDanger : undefined,
                              ]}
                            >
                              {node.delta}
                            </Text>
                            <Text style={styles.footnote}>{node.note}</Text>
                          </InsetPanel>
                        ))}
                      </View>
                    </InsetPanel>
                  ) : null}
                  {moneyFlowCards.length ? (
                    <InsetPanel tone="neutral">
                      <Text style={styles.rowTitle}>Money flow infographic</Text>
                      <View testID="ai-whatif-moneyflow" style={styles.moneyFlowGrid}>
                        {moneyFlowCards.map((card) => (
                          <InsetPanel key={card.label} tone={scenarioPanelTone(card.theme as ScenarioTheme)}>
                            <Text style={styles.heroEyebrow}>{card.label}</Text>
                            <Text style={[styles.metricValue, { color: scenarioRailColor(card.theme as ScenarioTheme) }]}>
                              {compactMoney(card.value)}
                            </Text>
                            <View style={styles.barTrack}>
                              <View style={[styles.barFillMuted, { width: `${Math.round(card.baseRatio * 100)}%` }]} />
                            </View>
                            <View style={styles.barTrack}>
                              <View
                                style={[
                                  styles.pressureBar,
                                  { backgroundColor: scenarioRailColor(card.theme as ScenarioTheme) },
                                  { width: `${Math.round(card.valueRatio * 100)}%` },
                                ]}
                              />
                            </View>
                            <Text style={styles.footnote}>{`${compactMoney(card.base)} -> ${compactMoney(card.value)}`}</Text>
                            <Text style={styles.footnote}>{card.note}</Text>
                          </InsetPanel>
                        ))}
                      </View>
                    </InsetPanel>
                  ) : null}
                  <StatGrid>
                    <StatTile label="Revenue delta" value={scenarioDeltaLabel(whatIfResult.delta.revenue_forecast_som as number | null | undefined)} />
                    <StatTile label="Delivery delta" value={scenarioDeltaLabel(whatIfResult.delta.delivery_rate_pct as number | null | undefined, "%")} tone="success" />
                    <StatTile label="Cancel delta" value={scenarioDeltaLabel(whatIfResult.delta.cancel_rate_pct as number | null | undefined, "%")} tone="warning" />
                    <StatTile label="Market share" value={`${pct(whatIfResult.baseline.marketSharePct)} -> ${pct(whatIfResult.scenario.marketSharePct)}`} tone="neutral" />
                  </StatGrid>
                  {compareBars.length > 0 ? (
                    <InsetPanel tone="neutral">
                      <Text style={styles.rowTitle}>Compare series</Text>
                      <CompareSeriesBars items={compareBars} />
                    </InsetPanel>
                  ) : null}
                  {drilldownBars.length > 0 ? (
                    <InsetPanel tone="neutral">
                      <Text style={styles.rowTitle}>{`Drilldown by ${whatIfResult.drilldown.by}`}</Text>
                      <DrilldownBars items={drilldownBars} />
                    </InsetPanel>
                  ) : null}
                  {(whatIfResult.drivers ?? []).slice(0, 3).map((driver, index) => (
                    <Text key={`${driver}-${index}`} style={styles.body}>{`\u2022 ${driver}`}</Text>
                  ))}
                  {(whatIfResult.warnings ?? []).length ? (
                    <InsetPanel tone="warning">
                      <Text style={styles.rowTitle}>Warnings</Text>
                      {(whatIfResult.warnings ?? []).slice(0, 4).map((warning, index) => (
                        <Text key={`${warning}-${index}`} style={styles.warningText}>{`\u2022 ${warning}`}</Text>
                      ))}
                    </InsetPanel>
                  ) : null}
                  {decisionCards.length ? (
                    <View style={styles.decisionGrid}>
                      {decisionCards.map((card) => (
                        <InsetPanel key={card.kicker} tone={decisionPanelTone(card.tone)}>
                          <Text style={styles.heroEyebrow}>{card.kicker}</Text>
                          <Text style={styles.rowTitle}>{card.title}</Text>
                          <Text style={styles.body}>{card.text}</Text>
                        </InsetPanel>
                      ))}
                    </View>
                  ) : null}
                  {scenarioActs.length ? (
                    <InsetPanel tone="neutral">
                      <Text style={styles.rowTitle}>Scenario acts</Text>
                      <View testID="ai-whatif-acts" style={styles.actsGrid}>
                        {scenarioActs.map((act) => (
                          <InsetPanel key={act.period} tone={act.tone === "up" ? "success" : act.tone === "down" ? "danger" : "neutral"}>
                            <View style={styles.barRowHead}>
                              <Text style={styles.heroEyebrow}>{act.period}</Text>
                              <Text
                                style={[
                                  styles.metricValue,
                                  {
                                    color:
                                      act.tone === "up"
                                        ? scenarioRailColor("green")
                                        : act.tone === "down"
                                          ? scenarioRailColor("red")
                                          : palette.primary,
                                  },
                                ]}
                              >
                                {`${act.delta >= 0 ? "+" : ""}${compactMoney(act.delta)}`}
                              </Text>
                            </View>
                          <Text style={styles.rowTitle}>{act.title}</Text>
                          <View style={styles.barTrack}>
                              <View
                                style={[
                                  styles.pressureBar,
                                  act.tone === "up"
                                    ? { backgroundColor: scenarioRailColor("green") }
                                    : act.tone === "down"
                                      ? { backgroundColor: scenarioRailColor("red") }
                                      : styles.barFillMuted,
                                  { width: `${Math.round(act.intensity)}%` },
                                ]}
                              />
                            </View>
                          </InsetPanel>
                        ))}
                      </View>
                    </InsetPanel>
                  ) : null}
                <SecondaryButton
                  testID="ai-whatif-discuss"
                  onPress={() =>
                    void sendQuestion(
                      `Explain this ${appRole} scenario in practical terms and tell me the top actions. Revenue ${Math.round(
                        whatIfResult.baseline.revenueForecastSom
                      )} -> ${Math.round(whatIfResult.scenario.revenueForecastSom)} som, delivery ${whatIfResult.baseline.deliveryRatePct.toFixed(
                        1
                      )}% -> ${whatIfResult.scenario.deliveryRatePct.toFixed(1)}%, cancel ${whatIfResult.baseline.cancelRatePct.toFixed(
                        1
                      )}% -> ${whatIfResult.scenario.cancelRatePct.toFixed(1)}%. Focus month: ${selectedMonth ?? whatIfResult.selectedMonth ?? "latest"}.`
                    )
                  }
                >
                  Discuss in AI chat
                </SecondaryButton>
                <PrimaryButton
                  testID="ai-whatif-save"
                  onPress={async () => {
                    if (!activeCompanyId) return;
                    try {
                      await services.analyticsApi.createWhatIfScenario({
                        companyId: activeCompanyId,
                        role: appRole,
                        title: `${appRole} scenario ${new Date().toLocaleDateString("en-US")}`,
                        horizonDays,
                        selectedMonth: selectedMonth ?? whatIfResult.selectedMonth,
                        levers: whatIfResult.levers,
                        result: whatIfResult,
                      });
                      await queryClient.invalidateQueries({ queryKey: ["what-if-scenarios"] });
                      toast.show("Scenario saved.", "success");
                    } catch (error) {
                      toast.show(error instanceof Error ? error.message : "Failed to save scenario.", "error");
                    }
                  }}
                >
                  Save scenario
                </PrimaryButton>
              </View>
            ) : null}
          </SectionCard>

          <SectionCard title="Saved scenarios" subtitle="Restore, rename or remove modeled scenes for the current company.">
            {(scenariosQuery.data?.items ?? []).length === 0 ? (
              <Text style={styles.body}>No saved what-if scenarios yet.</Text>
            ) : (
              scenariosQuery.data?.items.map((scenario) => (
                <View key={scenario.id} style={styles.scenarioShell}>
                  <ActionCard
                    title={scenario.title}
                    text={
                      scenario.result
                        ? `${scenario.role} - ${scenario.horizonDays}d - ${Math.round(scenario.result.baseline.revenueForecastSom)} -> ${Math.round(
                            scenario.result.scenario.revenueForecastSom
                          )} som`
                        : `${scenario.role} - ${scenario.horizonDays}d`
                    }
                    onPress={() => {
                      if (scenario.result) {
                        setWhatIfResult(scenario.result);
                        setDrilldownBy(scenario.result.drilldown.by);
                      }
                      setHorizonDays((scenario.horizonDays === 60 || scenario.horizonDays === 90 ? scenario.horizonDays : 30) as 30 | 60 | 90);
                      setSelectedMonth(scenario.selectedMonth ?? scenario.result?.selectedMonth ?? null);
                      setLeverDraft(draftFromScenarioLevers(appRole, scenario.levers));
                    }}
                  />
                  <View style={styles.rowActions}>
                    <SecondaryButton
                      onPress={() => {
                        setRenamingScenarioId(scenario.id);
                        setScenarioTitleDraft(scenario.title);
                      }}
                    >
                      Rename
                    </SecondaryButton>
                    <SecondaryButton
                      onPress={() => {
                        Alert.alert("Delete scenario", `Delete "${scenario.title}"?`, [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Delete",
                            style: "destructive",
                            onPress: async () => {
                              try {
                                await services.analyticsApi.deleteWhatIfScenario(scenario.id);
                                await queryClient.invalidateQueries({ queryKey: ["what-if-scenarios"] });
                              } catch (error) {
                                toast.show(error instanceof Error ? error.message : "Failed to delete scenario.", "error");
                              }
                            },
                          },
                        ]);
                      }}
                    >
                      Delete
                    </SecondaryButton>
                  </View>
                </View>
              ))
            )}
            {renamingScenarioId ? (
              <View style={styles.inlineEditor}>
                <Text style={styles.rowTitle}>Rename scenario</Text>
                <TextField label="Scenario title" value={scenarioTitleDraft} onChangeText={setScenarioTitleDraft} />
                <View style={styles.rowActions}>
                  <SecondaryButton
                    onPress={() => {
                      setRenamingScenarioId(null);
                      setScenarioTitleDraft("");
                    }}
                  >
                    Cancel
                  </SecondaryButton>
                  <PrimaryButton
                    onPress={async () => {
                      if (!scenarioTitleDraft.trim() || !renamingScenarioId) return;
                      try {
                        await services.analyticsApi.renameWhatIfScenario(renamingScenarioId, scenarioTitleDraft.trim());
                        await queryClient.invalidateQueries({ queryKey: ["what-if-scenarios"] });
                        setRenamingScenarioId(null);
                        setScenarioTitleDraft("");
                        toast.show("Scenario renamed.", "success");
                      } catch (error) {
                        toast.show(error instanceof Error ? error.message : "Failed to rename scenario.", "error");
                      }
                    }}
                  >
                    Save title
                  </PrimaryButton>
                </View>
              </View>
            ) : null}
          </SectionCard>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 14,
  },
  sessionRow: {
    gap: 8,
  },
  sessionMain: {
    flex: 1,
  },
  body: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  messageList: {
    gap: 4,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metricCard: {
    flexBasis: "47%",
    borderRadius: 14,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 10,
    gap: 4,
  },
  metricLabel: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  metricValue: {
    color: palette.primary,
    fontSize: 16,
    fontWeight: "800",
  },
  metricValueSmall: {
    color: palette.text,
    fontSize: 14,
    fontWeight: "800",
  },
  rowActions: {
    gap: 10,
  },
  pillGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  activeLeverChip: {
    borderRadius: 999,
    backgroundColor: palette.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  activeLeverText: {
    color: palette.primary,
    fontWeight: "700",
    fontSize: 12,
  },
  inlineEditor: {
    borderRadius: 18,
    backgroundColor: palette.bg,
    padding: 12,
    gap: 10,
  },
  whatIfResult: {
    gap: 8,
    borderRadius: 18,
    backgroundColor: palette.primarySoft,
    padding: 14,
  },
  heroEyebrow: {
    color: palette.primary,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  heroTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: "800",
  },
  pressureGrid: {
    gap: 10,
  },
  cascadeGrid: {
    gap: 10,
  },
  moneyFlowGrid: {
    gap: 10,
  },
  barList: {
    gap: 12,
  },
  barRow: {
    gap: 6,
  },
  barRowHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
  },
  barTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: palette.bg,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: palette.primary,
    minWidth: 10,
  },
  barFillMuted: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: palette.border,
    minWidth: 10,
  },
  barFillAccent: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: palette.accent,
    minWidth: 10,
  },
  pressureBar: {
    height: "100%",
    borderRadius: 999,
    minWidth: 10,
  },
  rowTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: "700",
  },
  footnote: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  warningText: {
    color: palette.danger,
    fontSize: 13,
    lineHeight: 18,
  },
  scenarioShell: {
    gap: 8,
  },
  decisionGrid: {
    gap: 10,
  },
  actsGrid: {
    gap: 10,
  },
  metricValueDanger: {
    color: palette.danger,
  },
});
