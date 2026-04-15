import { createDeliveriesApi, type Transport } from "@usc/core";

function makeTransport(handler: (path: string, options?: { method?: string; body?: unknown; auth?: boolean }) => unknown): Transport {
  return {
    request<T>(path: string, options?: { method?: string; body?: unknown; auth?: boolean }) {
      return Promise.resolve(handler(path, options) as T);
    },
  };
}

describe("mobile deliveries client", () => {
  it("normalizes assignable couriers", async () => {
    const api = createDeliveriesApi(
      makeTransport((path) => {
        expect(path).toBe("/deliveries/couriers/by_order/101/");
        return [
          {
            id: 50,
            email: "courier@test.local",
            first_name: "Courier",
            last_name: "One",
            phone: "+996700000000",
            company_ids: [10, 20],
          },
        ];
      })
    );

    const couriers = await api.listAssignableCouriers(101);
    expect(couriers[0]).toEqual({
      id: 50,
      email: "courier@test.local",
      firstName: "Courier",
      lastName: "One",
      phone: "+996700000000",
      companyIds: [10, 20],
    });
  });

  it("sends delivery upsert payload", async () => {
    const api = createDeliveriesApi(
      makeTransport((path, options) => {
        expect(path).toBe("/deliveries/upsert_for_order/");
        expect(options).toMatchObject({
          method: "POST",
          auth: true,
          body: {
            order: 101,
            courier: 50,
            tracking_link: "https://track.local/101",
            notes: "Call before delivery",
          },
        });
        return {
          id: 9,
          order_id: 101,
          courier_id: 50,
          status: "ASSIGNED",
          tracking_link: "https://track.local/101",
          notes: "Call before delivery",
        };
      })
    );

    const result = await api.upsertForOrder({
      orderId: 101,
      courierId: 50,
      trackingLink: "https://track.local/101",
      notes: "Call before delivery",
    });

    expect(result.courierId).toBe(50);
    expect(result.trackingLink).toBe("https://track.local/101");
    expect(result.notes).toBe("Call before delivery");
  });
});
