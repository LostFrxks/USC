import { buildHelpQuickActions, replyToHelpQuestion } from "@/screens/helpDesk";

describe("help desk helpers", () => {
  it("builds buyer quick actions", () => {
    const actions = buildHelpQuickActions("buyer");
    expect(actions[0].route).toBe("/(app)/(tabs)/orders");
    expect(actions.some((item) => item.id === "ai")).toBe(true);
  });

  it("builds supplier quick actions", () => {
    const actions = buildHelpQuickActions("supplier");
    expect(actions.some((item) => item.id === "deliveries")).toBe(true);
    expect(actions.some((item) => item.id === "publications")).toBe(true);
  });

  it("maps delivery questions to delivery workflow guidance", () => {
    expect(replyToHelpQuestion("buyer", "Delivery tracking is wrong")).toContain("delivery");
  });
});
