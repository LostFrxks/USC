import { buildAnalyticsMonthPrompt } from "@/screens/aiHandoff";

describe("ai handoff prompt builder", () => {
  it("builds buyer month prompt", () => {
    expect(buildAnalyticsMonthPrompt("buyer", "2026-04")).toContain("buyer performance");
  });

  it("builds supplier month prompt", () => {
    expect(buildAnalyticsMonthPrompt("supplier", "2026-04")).toContain("supplier performance");
  });
});
