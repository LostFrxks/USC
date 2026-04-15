import type { OrderSummary } from "@usc/core";
import { filterOrders, sortOrders, summarizeOrders } from "@/screens/ordersDashboard";

const ORDERS: OrderSummary[] = [
  {
    id: 1,
    status: "created",
    createdAt: "2026-04-02T09:00:00Z",
    deliveryAddress: "Bishkek",
    comment: "Urgent",
    total: 120,
  },
  {
    id: 2,
    status: "delivered",
    createdAt: "2026-04-03T09:00:00Z",
    deliveryAddress: "Osh",
    comment: "",
    total: 200,
  },
  {
    id: 3,
    status: "cancelled",
    createdAt: "2026-04-01T09:00:00Z",
    deliveryAddress: "Talas",
    comment: "[geo:42.0,74.0]",
    total: 50,
  },
];

describe("orders dashboard helpers", () => {
  it("builds order stats", () => {
    expect(summarizeOrders(ORDERS)).toEqual({
      all: 3,
      active: 1,
      delivered: 1,
      cancelled: 1,
      revenue: 370,
    });
  });

  it("filters orders by query and status", () => {
    expect(filterOrders(ORDERS, "bishkek", "active").map((item) => item.id)).toEqual([1]);
    expect(filterOrders(ORDERS, "usc-2", "all").map((item) => item.id)).toEqual([2]);
  });

  it("sorts orders by created date descending", () => {
    expect(sortOrders(ORDERS).map((item) => item.id)).toEqual([2, 1, 3]);
  });
});
