import type { OrderStatus } from "@usc/core";

export function orderStatusLabel(status: OrderStatus): string {
  switch (status) {
    case "created":
      return "Created";
    case "confirmed":
      return "Confirmed";
    case "delivering":
      return "Delivering";
    case "delivered":
      return "Delivered";
    case "partially_delivered":
      return "Partially delivered";
    case "cancelled":
      return "Cancelled";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}

export function deliveryStatusLabel(status?: string | null): string {
  switch ((status || "").toUpperCase()) {
    case "ASSIGNED":
      return "Assigned";
    case "PICKED_UP":
      return "Picked up";
    case "ON_THE_WAY":
      return "On the way";
    case "DELIVERED":
      return "Delivered";
    case "FAILED":
      return "Failed";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status || "Unknown";
  }
}
