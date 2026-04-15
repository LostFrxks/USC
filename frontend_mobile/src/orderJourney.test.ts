import type { OrderDetail } from "@usc/core";
import { buildOrderJourney, computeOrderTotal, deliveryStatusOptions, formatOrderCreatedAt, orderJourneyNote } from "@/screens/orderJourney";

function makeOrder(overrides: Partial<OrderDetail> = {}): OrderDetail {
  return {
    id: 1,
    status: "confirmed",
    createdAt: "2026-04-02T10:00:00Z",
    deliveryAddress: "Mederova 161a",
    deliveryLat: null,
    deliveryLng: null,
    comment: "",
    buyerCompanyId: 10,
    supplierCompanyId: 20,
    itemsCount: 2,
    total: null,
    items: [
      { productId: 1, qty: 2, priceSnapshot: 120, name: "Milk" },
      { productId: 2, qty: 1, priceSnapshot: 80, name: "Bread" },
    ],
    ...overrides,
  };
}

describe("order journey helpers", () => {
  it("builds done/current/pending order journey states", () => {
    const steps = buildOrderJourney("delivering");
    expect(steps.map((step) => step.state)).toEqual(["done", "done", "current", "pending"]);
  });

  it("returns contextual note for cancelled orders", () => {
    expect(orderJourneyNote("cancelled")).toContain("Cancelled");
  });

  it("computes total from price snapshots", () => {
    expect(computeOrderTotal(makeOrder())).toBe(320);
  });

  it("formats created date for detail header", () => {
    expect(formatOrderCreatedAt(makeOrder())).toContain("2026");
  });

  it("keeps current unknown delivery status in the selector options", () => {
    expect(deliveryStatusOptions({ id: 1, orderId: 5, status: "RETURNED" })).toContain("RETURNED");
  });
});
