import type { NotificationItem, NotificationList } from "../types/domain";
import type { Transport } from "../transport/contracts";

function normalizeNotification(item: {
  id: number;
  domain: string;
  event_type: string;
  resource_type: string;
  resource_id: string;
  title: string;
  text: string;
  payload?: Record<string, unknown>;
  created_at?: string | null;
  is_read: boolean;
  read_at?: string | null;
}): NotificationItem {
  return {
    id: item.id,
    domain: item.domain,
    eventType: item.event_type,
    resourceType: item.resource_type,
    resourceId: item.resource_id,
    title: item.title,
    text: item.text,
    payload: item.payload,
    createdAt: item.created_at ?? null,
    isRead: item.is_read,
    readAt: item.read_at ?? null,
  };
}

export function createNotificationsApi(transport: Transport) {
  return {
    async list(limit = 20): Promise<NotificationList> {
      const data = await transport.request<{
        items: Array<{
          id: number;
          domain: string;
          event_type: string;
          resource_type: string;
          resource_id: string;
          title: string;
          text: string;
          payload?: Record<string, unknown>;
          created_at?: string | null;
          is_read: boolean;
          read_at?: string | null;
        }>;
        unread_count: number;
      }>(`/notifications/?limit=${limit}`, { auth: true });

      return {
        items: (data.items ?? []).map(normalizeNotification),
        unreadCount: data.unread_count ?? 0,
      };
    },

    markRead(notificationId: number) {
      return transport.request<{ updated: boolean }>(`/notifications/${notificationId}/read/`, {
        method: "POST",
        auth: true,
      });
    },

    markAllRead() {
      return transport.request<{ updated_count: number }>("/notifications/read_all/", {
        method: "POST",
        auth: true,
      });
    },
  };
}
