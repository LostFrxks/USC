import type { WhatIfResponse } from "@usc/core";
import { buildScenarioCompareBars, buildScenarioDrilldownBars, scenarioDeltaLabel } from "@/screens/aiVisuals";

function makeScenario(): WhatIfResponse {
  return {
    role: "buyer",
    horizonDays: 30,
    selectedMonth: "2026-04",
    levers: {
      deliveryImprovePp: 2,
      cancelReducePp: 1,
      topCategoryShareReducePp: 0,
      promoIntensityPct: 5,
      cheaperSupplierShiftPct: 4,
      reliableSupplierShiftPct: 3,
      priceCutOverpricedPct: 0,
      pipelineRecoveryPct: 0,
    },
    baseline: {
      horizonDays: 30,
      periods: 3,
      monthlyBaseSom: 100,
      revenueForecastSom: 1200,
      momPct: 2,
      deliveryRatePct: 94,
      cancelRatePct: 4,
      marketSharePct: 10,
      topCategoryName: "Dairy",
      topCategorySharePct: 40,
      supplierHhi: 0.4,
      categoryHhi: 0.3,
      savingsPotentialSom: 200,
      avgWatchSavingsPct: 7,
      leakageScore: 12,
      leakageValueSom: 100,
      repeatRatePct: 50,
    },
    scenario: {
      horizonDays: 30,
      periods: 3,
      monthlyBaseSom: 110,
      revenueForecastSom: 1500,
      momPct: 4,
      deliveryRatePct: 96,
      cancelRatePct: 3,
      marketSharePct: 11,
      topCategoryName: "Dairy",
      topCategorySharePct: 42,
      supplierHhi: 0.38,
      categoryHhi: 0.28,
      savingsPotentialSom: 260,
      avgWatchSavingsPct: 8,
      leakageScore: 10,
      leakageValueSom: 60,
      repeatRatePct: 56,
    },
    delta: {
      revenue_forecast_som: 300,
      delivery_rate_pct: 2,
      cancel_rate_pct: -1,
    },
    compareSeries: [
      { period: "2026-03", baseline: 900, scenario: 1000 },
      { period: "2026-04", baseline: 1200, scenario: 1500 },
    ],
    drilldown: {
      by: "category",
      points: [
        { key: "Dairy", baseline: 700, scenario: 900, deltaPct: 28.6 },
        { key: "Bakery", baseline: 500, scenario: 600, deltaPct: 20 },
      ],
    },
    drivers: ["Improve supplier reliability"],
    warnings: ["Watch inventory on fast movers"],
    confidence: 0.8,
  };
}

describe("ai visuals helpers", () => {
  it("builds normalized compare bars", () => {
    const bars = buildScenarioCompareBars(makeScenario());
    expect(bars[1].label).toBe("Apr");
    expect(bars[1].scenarioRatio).toBe(1);
    expect(bars[0].baselineRatio).toBeLessThan(1);
  });

  it("builds drilldown bars with delta", () => {
    const bars = buildScenarioDrilldownBars(makeScenario());
    expect(bars[0].label).toBe("Dairy");
    expect(bars[0].deltaPct).toBe(28.6);
    expect(bars[0].ratio).toBe(1);
  });

  it("formats signed delta labels", () => {
    expect(scenarioDeltaLabel(2.4, "%")).toBe("+2.4%");
    expect(scenarioDeltaLabel(-1.2, "%")).toBe("-1.2%");
    expect(scenarioDeltaLabel(null, "%")).toBe("n/a");
  });
});
