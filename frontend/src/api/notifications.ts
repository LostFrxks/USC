import { api } from "./client";

export type NotificationItem = {
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
};

export type NotificationListResponse = {
  items: NotificationItem[];
  unread_count: number;
};

export async function fetchNotifications(limit = 20) {
  return api<NotificationListResponse>(`/notifications/?limit=${limit}`, { auth: true });
}

export async function markNotificationRead(notificationId: number) {
  return api<{ updated: boolean }>(`/notifications/${notificationId}/read/`, {
    method: "POST",
    auth: true,
  });
}

export async function markAllNotificationsRead() {
  return api<{ updated_count: number }>("/notifications/read_all/", {
    method: "POST",
    auth: true,
  });
}
