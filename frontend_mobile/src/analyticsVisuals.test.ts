import { buildCategoryBars, buildFunnelBars, buildTrendBars, formatAnalyticsPeriod } from "@/screens/analyticsVisuals";

describe("analytics visuals helpers", () => {
  it("formats month periods for compact chart labels", () => {
    expect(formatAnalyticsPeriod("2026-04")).toBe("Apr");
    expect(formatAnalyticsPeriod("2026-04-02")).toContain("Apr");
  });

  it("builds normalized trend bars", () => {
    const bars = buildTrendBars([
      { month: "2026-01", revenue: 100 },
      { month: "2026-02", revenue: 250 },
    ]);
    expect(bars[0].key).toBe("2026-01");
    expect(bars[0].label).toBe("Jan");
    expect(bars[1].ratio).toBe(1);
    expect(bars[0].ratio).toBeLessThan(1);
  });

  it("builds category bars using share percentage", () => {
    const bars = buildCategoryBars([
      { name: "Dairy", revenue: 1000, sharePct: 50 },
      { name: "Bakery", revenue: 500, sharePct: 25 },
    ]);
    expect(bars[0].note).toBe("1000");
    expect(bars[1].ratio).toBeLessThan(1);
  });

  it("builds funnel bars using count ratios", () => {
    const bars = buildFunnelBars([
      { status: "CREATED", count: 10 },
      { status: "DELIVERED", count: 5 },
    ]);
    expect(bars[0].ratio).toBe(1);
    expect(bars[1].ratio).toBeLessThan(1);
  });
});
