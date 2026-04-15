import { createProfileApi, type Transport } from "@usc/core";

function makeTransport(handler: (path: string, options?: { method?: string; body?: unknown; auth?: boolean }) => unknown): Transport {
  return {
    request<T>(path: string, options?: { method?: string; body?: unknown; auth?: boolean }) {
      return Promise.resolve(handler(path, options) as T);
    },
  };
}

describe("profile client", () => {
  it("sends courier flag and normalizes returned profile", async () => {
    const api = createProfileApi(
      makeTransport((path, options) => {
        expect(path).toBe("/profile/me/");
        expect(options?.method).toBe("PATCH");
        expect(options?.auth).toBe(true);
        expect(options?.body).toMatchObject({
          first_name: "Alice",
          is_courier_enabled: true,
          active_company_id: 10,
        });
        return {
          id: 7,
          email: "alice@test.local",
          first_name: "Alice",
          last_name: "Courier",
          phone: "+996700111111",
          role: "supplier",
          is_courier_enabled: true,
          companies: [
            {
              company_id: 10,
              name: "USC Supplier",
              company_type: "SUPPLIER",
              phone: "+996700222333",
              address: "Bishkek",
              role: "OWNER",
            },
          ],
        };
      })
    );

    const result = await api.updateMe({
      firstName: "Alice",
      isCourierEnabled: true,
      activeCompanyId: 10,
    });

    expect(result.isCourierEnabled).toBe(true);
    expect(result.companies[0].companyType).toBe("SUPPLIER");
  });
});
