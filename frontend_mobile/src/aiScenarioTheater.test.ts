import type { WhatIfResponse } from "@usc/core";
import { buildScenarioActs, buildScenarioCascadeNodes, buildScenarioMoneyFlowCards, compactMoney } from "@/screens/aiScenarioTheater";

function makeScenario(): WhatIfResponse {
  return {
    role: "supplier",
    horizonDays: 30,
    selectedMonth: "2026-04",
    levers: {
      deliveryImprovePp: 3,
      cancelReducePp: 1,
      topCategoryShareReducePp: 0,
      promoIntensityPct: 5,
      cheaperSupplierShiftPct: 0,
      reliableSupplierShiftPct: 0,
      priceCutOverpricedPct: 4,
      pipelineRecoveryPct: 10,
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
      points: [{ key: "Dairy", baseline: 700, scenario: 900, deltaPct: 28.6 }],
    },
    drivers: ["Improve supplier reliability"],
    warnings: ["Watch inventory"],
    confidence: 0.8,
  };
}

describe("ai scenario theater", () => {
  it("formats compact money labels", () => {
    expect(compactMoney(1500)).toBe("1.5k som");
  });

  it("builds money flow cards with normalized ratios", () => {
    const cards = buildScenarioMoneyFlowCards("supplier", makeScenario());
    expect(cards).toHaveLength(4);
    expect(cards[0].label).toBe("Demand entering");
    expect(Math.max(...cards.map((card) => card.valueRatio))).toBe(1);
    expect(cards[3].label).toBe("Retained value");
  });

  it("builds scenario acts from compare series", () => {
    const acts = buildScenarioActs(makeScenario());
    expect(acts).toHaveLength(2);
    expect(acts[0].title).toBe("Demand ignition");
  });

  it("builds impact cascade nodes", () => {
    const nodes = buildScenarioCascadeNodes("supplier", makeScenario());
    expect(nodes).toHaveLength(4);
    expect(nodes[0].eyebrow).toBe("Demand pulse");
    expect(nodes[3].title).toBe("Retained value");
  });
});
