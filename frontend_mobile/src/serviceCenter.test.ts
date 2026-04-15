import { SERVICE_FAQ, buildServiceAiPrompt, filterServiceFaq } from "@/screens/serviceCenter";

describe("service center helpers", () => {
  it("filters FAQ by category", () => {
    const items = filterServiceFaq(SERVICE_FAQ, "", "orders");
    expect(items.every((item) => item.category === "orders")).toBe(true);
  });

  it("filters FAQ by query", () => {
    const items = filterServiceFaq(SERVICE_FAQ, "payment", "all");
    expect(items[0].id).toBe("payments");
  });

  it("builds role-aware AI support prompt", () => {
    expect(buildServiceAiPrompt("buyer", SERVICE_FAQ[0])).toContain("buyer-side");
    expect(buildServiceAiPrompt("supplier", SERVICE_FAQ[1])).toContain("supplier-side");
  });
});
