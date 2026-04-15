import { useMemo, useState } from "react";
import { router } from "expo-router";
import { Text, View } from "react-native";
import { useSelectedCompany } from "@/session/SelectedCompanyProvider";
import { NotificationsAction } from "@/ui/AppHeaderAction";
import { ActionCard, ActionGrid, DataRow, HeroBanner, InsetPanel, MessageBubble, MessageStack, MetaTag, SectionCard, StatGrid, StatTile } from "@/ui/BusinessUI";
import { PrimaryButton } from "@/ui/Buttons";
import { Screen } from "@/ui/Screen";
import { TextField } from "@/ui/TextField";
import { buildHelpQuickActions, replyToHelpQuestion } from "@/screens/helpDesk";

type Message = { id: string; type: "incoming" | "outgoing"; text: string; meta: string };

export function HelpScreen() {
  const { appRole, activeCompany } = useSelectedCompany();
  const initial = useMemo<Message[]>(
    () => [
      {
        id: "m1",
        type: "incoming",
        text: `Hello, this is USC support for ${activeCompany?.name ?? "the active company"}. Describe the issue and use the shortcuts below to jump straight into the right workflow.`,
        meta: "USC Support",
      },
    ],
    [activeCompany?.name]
  );

  const [messages, setMessages] = useState<Message[]>(initial);
  const [value, setValue] = useState("");
  const quickActions = useMemo(() => buildHelpQuickActions(appRole), [appRole]);

  function send() {
    const text = value.trim();
    if (!text) return;
    const id = `m${Date.now()}`;
    const reply = replyToHelpQuestion(appRole, text);
    setMessages((prev) => [
      ...prev,
      { id, type: "outgoing", text, meta: "You" },
      {
        id: `${id}-reply`,
        type: "incoming",
        text: reply,
        meta: "USC Support",
      },
    ]);
    setValue("");
  }

  return (
    <Screen testID="screen-help" title="Help" subtitle="Operational support hub" headerRight={<NotificationsAction />}>
      <HeroBanner
        eyebrow="Support hub"
        title={activeCompany?.name ?? "Operational support"}
        text="Jump straight into the right workflow or ask USC support for the next operational action."
        aside={<MetaTag label={appRole} tone="primary" />}
      />

      <StatGrid>
        <StatTile label="Role" value={appRole} tone="neutral" />
        <StatTile label="Shortcuts" value={quickActions.length} />
        <StatTile label="Messages" value={messages.length} tone="neutral" />
        <StatTile label="Workspace" value={activeCompany?.name ?? "None"} tone="neutral" />
      </StatGrid>

      <SectionCard title="Quick actions" subtitle="Route directly into the workflow that usually resolves the issue fastest.">
        <InsetPanel tone="neutral">
          <DataRow
            title="Suggested route"
            body={`Use one of ${quickActions.length} shortcuts below to jump directly into the most likely workflow for this issue.`}
            meta="If the pattern is unclear, open AI diagnostic from the same section."
            trailing={<MetaTag label="Fast path" tone="primary" />}
          />
        </InsetPanel>
        <ActionGrid>
          {quickActions.map((action) => (
            <ActionCard
              key={action.id}
              testID={`help-action-${action.id}`}
              title={action.label}
              text={action.description}
              onPress={() => {
                if (action.aiPrompt) {
                  router.push({
                    pathname: "/(app)/ai",
                    params: { prompt: action.aiPrompt, autorun: "1" },
                  });
                  return;
                }
                if (action.route) {
                  router.push(action.route as never);
                }
              }}
            />
          ))}
        </ActionGrid>
      </SectionCard>

      <SectionCard title="Support conversation" subtitle="Describe the issue in one sentence to get the next operational suggestion.">
        <InsetPanel tone="neutral">
          <DataRow
            title="How to ask better"
            body="Mention the workflow first: order, delivery, SKU, analytics, payment or supplier issue."
            meta="Short, operational prompts work best in this support surface."
            trailing={<MetaTag label="Prompt tip" tone="accent" />}
          />
        </InsetPanel>
        <MessageStack testID="help-window">
          {messages.map((message) => (
            <MessageBubble key={message.id} tone={message.type === "incoming" ? "assistant" : "user"} eyebrow={message.meta} body={message.text} />
          ))}
        </MessageStack>
        <TextField testID="help-input" label="Question" value={value} onChangeText={setValue} />
        <PrimaryButton testID="help-submit" onPress={send}>Send</PrimaryButton>
      </SectionCard>
    </Screen>
  );
}
