import type { NotificationItem } from "@usc/core";

export type NotificationFilter = "all" | "unread" | "orders" | "deliveries" | "system";

export function classifyNotification(item: NotificationItem): Exclude<NotificationFilter, "all" | "unread"> {
  const resourceType = String(item.resourceType || "").toLowerCase();
  const domain = String(item.domain || "").toLowerCase();
  if (resourceType === "order" || domain.includes("order")) return "orders";
  if (resourceType === "delivery" || domain.includes("delivery")) return "deliveries";
  return "system";
}

export function filterNotifications(items: NotificationItem[], query: string, filter: NotificationFilter): NotificationItem[] {
  const normalized = query.trim().toLowerCase();
  return items.filter((item) => {
    if (filter === "unread" && item.isRead) return false;
    if (filter !== "all" && filter !== "unread" && classifyNotification(item) !== filter) return false;
    if (!normalized) return true;
    return (
      item.title.toLowerCase().includes(normalized) ||
      item.text.toLowerCase().includes(normalized) ||
      String(item.domain || "").toLowerCase().includes(normalized)
    );
  });
}

export function notificationStats(items: NotificationItem[]) {
  return items.reduce(
    (acc, item) => {
      acc.all += 1;
      if (!item.isRead) acc.unread += 1;
      const bucket = classifyNotification(item);
      acc[bucket] += 1;
      return acc;
    },
    { all: 0, unread: 0, orders: 0, deliveries: 0, system: 0 }
  );
}
