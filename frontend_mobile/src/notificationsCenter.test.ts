import type { NotificationItem } from "@usc/core";
import { classifyNotification, filterNotifications, notificationStats } from "@/screens/notificationsCenter";

const ITEMS: NotificationItem[] = [
  {
    id: 1,
    domain: "order",
    eventType: "created",
    resourceType: "order",
    resourceId: "10",
    title: "Order created",
    text: "USC-10 is pending",
    isRead: false,
  },
  {
    id: 2,
    domain: "delivery",
    eventType: "assigned",
    resourceType: "delivery",
    resourceId: "20",
    title: "Delivery assigned",
    text: "Courier assigned",
    isRead: true,
  },
  {
    id: 3,
    domain: "system",
    eventType: "info",
    resourceType: "misc",
    resourceId: "30",
    title: "System update",
    text: "Profile updated",
    isRead: false,
  },
];

describe("notifications center helpers", () => {
  it("classifies notifications by domain", () => {
    expect(classifyNotification(ITEMS[0])).toBe("orders");
    expect(classifyNotification(ITEMS[1])).toBe("deliveries");
    expect(classifyNotification(ITEMS[2])).toBe("system");
  });

  it("filters notifications by unread and query", () => {
    expect(filterNotifications(ITEMS, "", "unread").map((item) => item.id)).toEqual([1, 3]);
    expect(filterNotifications(ITEMS, "courier", "all").map((item) => item.id)).toEqual([2]);
  });

  it("builds notification stats", () => {
    expect(notificationStats(ITEMS)).toEqual({
      all: 3,
      unread: 2,
      orders: 1,
      deliveries: 1,
      system: 1,
    });
  });
});
