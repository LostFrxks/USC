import { api } from "./client";

export type NotificationItem = {
  id: string;
  type: "order" | "delivery";
  title: string;
  text: string;
  order_id?: number | null;
  status?: string | null;
  created_at?: string | null;
  is_new?: boolean;
};

export async function fetchNotifications(limit = 20) {
  return api<NotificationItem[]>(`/notifications/?limit=${limit}`, { auth: true });
}
