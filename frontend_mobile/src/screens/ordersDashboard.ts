import type { OrderSummary } from "@usc/core";
import { isActiveOrderStatus, isCancelledOrderStatus, stripGeoTag } from "@usc/core";

export type OrderFilter = "all" | "active" | "delivered" | "cancelled";

export type OrderStats = {
  all: number;
  active: number;
  delivered: number;
  cancelled: number;
  revenue: number;
};

export function summarizeOrders(items: OrderSummary[]): OrderStats {
  return items.reduce<OrderStats>(
    (acc, order) => {
      acc.all += 1;
      if (isActiveOrderStatus(order.status)) acc.active += 1;
      if (order.status === "delivered") acc.delivered += 1;
      if (isCancelledOrderStatus(order.status)) acc.cancelled += 1;
      acc.revenue += Number(order.total ?? 0);
      return acc;
    },
    { all: 0, active: 0, delivered: 0, cancelled: 0, revenue: 0 }
  );
}

export function filterOrders(items: OrderSummary[], query: string, filter: OrderFilter): OrderSummary[] {
  const normalized = query.trim().toLowerCase();
  return items.filter((order) => {
    if (filter === "active" && !isActiveOrderStatus(order.status)) return false;
    if (filter === "delivered" && order.status !== "delivered") return false;
    if (filter === "cancelled" && !isCancelledOrderStatus(order.status)) return false;

    if (!normalized) return true;
    const haystack = [
      `usc-${order.id}`,
      order.status,
      order.deliveryAddress,
      stripGeoTag(order.comment),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalized);
  });
}

export function sortOrders(items: OrderSummary[]): OrderSummary[] {
  return [...items].sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (aTime !== bTime) return bTime - aTime;
    return b.id - a.id;
  });
}
