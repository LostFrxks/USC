import type { DeliveryRecord, OrderDetail, OrderStatus } from "@usc/core";

export type JourneyVisualState = "done" | "current" | "pending";

export type JourneyStep = {
  key: string;
  label: string;
  state: JourneyVisualState;
};

const ORDER_FLOW: Array<{ key: string; label: string }> = [
  { key: "created", label: "Created" },
  { key: "confirmed", label: "Confirmed" },
  { key: "delivering", label: "Delivering" },
  { key: "delivered", label: "Delivered" },
];

const DELIVERY_STATUS_OPTIONS = ["ASSIGNED", "PICKED_UP", "ON_THE_WAY", "DELIVERED", "FAILED"] as const;

function statusIndex(status: OrderStatus): number {
  switch (status) {
    case "created":
    case "cancelled":
    case "failed":
      return 0;
    case "confirmed":
      return 1;
    case "delivering":
    case "partially_delivered":
      return 2;
    case "delivered":
      return 3;
    default:
      return 0;
  }
}

export function buildOrderJourney(status: OrderStatus): JourneyStep[] {
  const currentIndex = statusIndex(status);
  return ORDER_FLOW.map((step, index) => ({
    ...step,
    state: index < currentIndex ? "done" : index === currentIndex ? "current" : "pending",
  }));
}

export function orderJourneyNote(status: OrderStatus): string | null {
  if (status === "cancelled") {
    return 'Order stopped: status "Cancelled".';
  }
  if (status === "failed") {
    return 'Order stopped: status "Failed".';
  }
  if (status === "partially_delivered") {
    return 'Shipment is partially delivered and still in progress.';
  }
  return null;
}

export function computeOrderTotal(order: OrderDetail | null | undefined): number | null {
  if (!order?.items?.length) return null;
  const total = order.items.reduce((sum, item) => {
    if (typeof item.priceSnapshot !== "number") return sum;
    return sum + item.priceSnapshot * item.qty;
  }, 0);
  return total > 0 ? total : null;
}

export function formatOrderCreatedAt(order: OrderDetail | null | undefined): string | null {
  if (!order?.createdAt) return null;
  const date = new Date(order.createdAt);
  if (Number.isNaN(date.getTime())) return order.createdAt;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function deliveryStatusOptions(delivery: DeliveryRecord | null | undefined): string[] {
  if (!delivery) return [];
  const current = String(delivery.status ?? "").toUpperCase();
  if (current && !DELIVERY_STATUS_OPTIONS.includes(current as (typeof DELIVERY_STATUS_OPTIONS)[number])) {
    return [current, ...DELIVERY_STATUS_OPTIONS];
  }
  return [...DELIVERY_STATUS_OPTIONS];
}
