import type { CatalogImageKey, DeliveryStatus, OrderStatus } from "../types/domain";

const CATEGORY_BY_NAME: Record<string, CatalogImageKey> = {
  meat: "meat",
  milk: "milk",
  fish: "fish",
  bread: "bread",
  fruit: "fruit",
  grain: "grain",
};

const CATEGORY_BY_ID: Record<number, CatalogImageKey> = {
  1: "meat",
  2: "milk",
  3: "fish",
  4: "bread",
  5: "fruit",
  6: "grain",
};

export function normalizeOrderStatus(raw: string): OrderStatus {
  const up = (raw || "").toUpperCase();
  switch (up) {
    case "PENDING":
    case "CREATED":
      return "created";
    case "CONFIRMED":
      return "confirmed";
    case "DELIVERING":
      return "delivering";
    case "DELIVERED":
      return "delivered";
    case "PARTIALLY_DELIVERED":
      return "partially_delivered";
    case "CANCELLED":
    case "CANCELED":
      return "cancelled";
    case "FAILED":
      return "failed";
    default:
      return "created";
  }
}

export function normalizeDeliveryStatus(raw?: string | null): DeliveryStatus {
  switch ((raw || "").toUpperCase()) {
    case "ASSIGNED":
      return "assigned";
    case "PICKED_UP":
      return "picked_up";
    case "ON_THE_WAY":
      return "on_the_way";
    case "DELIVERED":
      return "delivered";
    case "FAILED":
      return "failed";
    case "CANCELLED":
      return "cancelled";
    default:
      return "unknown";
  }
}

export function isCancelledOrderStatus(status: OrderStatus): boolean {
  return status === "cancelled";
}

export function isActiveOrderStatus(status: OrderStatus): boolean {
  return status === "created" || status === "confirmed" || status === "delivering";
}

export function resolveCatalogImageKey(input: { categoryId?: number | null; categoryName?: string | null }): CatalogImageKey {
  const byName = CATEGORY_BY_NAME[String(input.categoryName || "").toLowerCase()];
  if (byName) return byName;
  const byId = input.categoryId != null ? CATEGORY_BY_ID[input.categoryId] : undefined;
  return byId ?? "default";
}
