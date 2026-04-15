import type { AiChatSession, AppRole } from "../types/domain";
import type { Transport } from "../transport/contracts";

function normalizeSession(session: any): AiChatSession {
  return {
    id: session.id,
    title: session.title,
    createdAt: session.created_at,
    updatedAt: session.updated_at,
    lastMessageAt: session.last_message_at ?? null,
    messageCount: session.message_count ?? 0,
    preview: session.preview ?? "",
    messages: (session.messages ?? []).map((message: any) => ({
      id: message.id,
      role: message.role,
      text: message.text,
      createdAt: message.created_at,
      payload: message.payload ?? null,
    })),
  };
}

export function createAiChatApi(transport: Transport) {
  return {
    async listSessions(params: { companyId: number; role: AppRole; limit?: number; messageLimit?: number }): Promise<{ sessions: AiChatSession[]; currentId: number | null }> {
      const qs = new URLSearchParams();
      qs.set("company_id", String(params.companyId));
      qs.set("role", params.role);
      if (params.limit != null) qs.set("limit", String(params.limit));
      if (params.messageLimit != null) qs.set("message_limit", String(params.messageLimit));
      const data = await transport.request<any>(`/analytics/assistant/chats?${qs.toString()}`, { auth: true });
      return {
        sessions: (data.sessions ?? []).map(normalizeSession),
        currentId: data.current_id ?? null,
      };
    },

    async createSession(params: { companyId: number; role: AppRole; title?: string | null }) {
      const data = await transport.request<any>("/analytics/assistant/chats", {
        method: "POST",
        auth: true,
        body: {
          company_id: params.companyId,
          role: params.role,
          title: params.title ?? null,
        },
      });
      return normalizeSession(data);
    },

    renameSession(sessionId: number, title: string) {
      return transport.request<{ id: number; title: string; updated_at?: string }>(`/analytics/assistant/chats/${sessionId}`, {
        method: "PATCH",
        auth: true,
        body: { title },
      });
    },

    deleteSession(sessionId: number) {
      return transport.request<{ deleted: boolean }>(`/analytics/assistant/chats/${sessionId}`, {
        method: "DELETE",
        auth: true,
      });
    },
  };
}
