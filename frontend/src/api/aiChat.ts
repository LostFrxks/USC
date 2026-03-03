import { api } from "./client";
import type { AnalyticsAssistantResponse } from "./analytics";

export type AiChatRole = "buyer" | "supplier";

export type AiChatMessageDto = {
  id: number;
  role: "user" | "assistant";
  text: string;
  created_at: string;
  payload?: AnalyticsAssistantResponse | null;
};

export type AiChatSessionDto = {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
  message_count: number;
  preview: string;
  messages: AiChatMessageDto[];
};

export async function fetchAiChatSessions(params: {
  companyId: number;
  role: AiChatRole;
  limit?: number;
  messageLimit?: number;
}) {
  const qs = new URLSearchParams();
  qs.set("company_id", String(params.companyId));
  qs.set("role", params.role);
  if (params.limit != null) qs.set("limit", String(params.limit));
  if (params.messageLimit != null) qs.set("message_limit", String(params.messageLimit));
  return api<{ sessions: AiChatSessionDto[]; current_id: number | null }>(`/analytics/assistant/chats?${qs.toString()}`, { auth: true });
}

export async function createAiChatSession(params: { companyId: number; role: AiChatRole; title?: string | null }) {
  return api<AiChatSessionDto>("/analytics/assistant/chats", {
    method: "POST",
    auth: true,
    body: {
      company_id: params.companyId,
      role: params.role,
      title: params.title ?? null,
    },
  });
}

export async function renameAiChatSession(sessionId: number, title: string) {
  return api<{ id: number; title: string; updated_at?: string }>(`/analytics/assistant/chats/${sessionId}`, {
    method: "PATCH",
    auth: true,
    body: { title },
  });
}

export async function deleteAiChatSession(sessionId: number) {
  return api<{ deleted: boolean }>(`/analytics/assistant/chats/${sessionId}`, {
    method: "DELETE",
    auth: true,
  });
}
