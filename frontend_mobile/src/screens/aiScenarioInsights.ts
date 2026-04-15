import type { AppRole, WhatIfResponse } from "@usc/core";

export type ScenarioTone = "up" | "down" | "neutral";
export type ScenarioTheme = "blue" | "amber" | "green" | "red" | "gold";

export type ScenarioHeadline = {
  title: string;
  text: string;
};

export type ScenarioPressureCard = {
  label: string;
  value: number;
  text: string;
  theme: ScenarioTheme;
};

export type ScenarioDecisionCard = {
  kicker: string;
  title: string;
  text: string;
  tone: ScenarioTone;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function tone(value: number): ScenarioTone {
  return value > 0 ? "up" : value < 0 ? "down" : "neutral";
}

function goodTone(value: number, improveWhen: "up" | "down"): ScenarioTone {
  if (value === 0) return "neutral";
  if (improveWhen === "up") return value > 0 ? "up" : "down";
  return value < 0 ? "up" : "down";
}

function retainedValues(result: WhatIfResponse) {
  const baseline = result.baseline.revenueForecastSom - result.baseline.leakageValueSom + result.baseline.savingsPotentialSom;
  const scenario = result.scenario.revenueForecastSom - result.scenario.leakageValueSom + result.scenario.savingsPotentialSom;
  return {
    baseline,
    scenario,
    delta: scenario - baseline,
  };
}

export function buildScenarioHeadline(role: AppRole, result: WhatIfResponse | null | undefined): ScenarioHeadline {
  if (!result) {
    return {
      title: "Assemble the scenario",
      text: "Adjust the levers and the model will show where growth appears and where the plan starts overheating.",
    };
  }

  const revenueDelta = Number(result.delta.revenue_forecast_som || 0);
  const deliveryDelta = Number(result.delta.delivery_rate_pct || 0);
  const cancelDelta = Number(result.delta.cancel_rate_pct || 0);

  if (revenueDelta > 0 && deliveryDelta >= 0 && cancelDelta <= 0) {
    return {
      title: "The scenario opens upside without losing control",
      text:
        role === "buyer"
          ? "Savings and service quality improve together. The modeled gain is not being eaten by fulfilment friction."
          : "Demand growth stays compatible with delivery execution, so the upside looks operationally plausible.",
    };
  }

  if (revenueDelta > 0) {
    return {
      title: "Growth appears, but the scene is under pressure",
      text:
        role === "buyer"
          ? "The upside is visible, but some of it leaks through cancellation pressure or unstable execution."
          : "Revenue improves, but the model still flags operational strain that can dilute the win.",
    };
  }

  return {
    title: "The scenario still needs rewiring",
    text:
      role === "buyer"
        ? "Current lever mix is not creating enough buyer-side upside or de-risking the supply footprint."
        : "Current lever mix is not creating enough supplier-side upside or removing enough pipeline friction.",
  };
}

export function buildScenarioPressureCards(role: AppRole, result: WhatIfResponse | null | undefined): ScenarioPressureCard[] {
  if (!result) return [];
  const revenueDelta = Number(result.delta.revenue_forecast_som || 0);

  return [
    {
      label: "Demand heat",
      value: clamp(48 + (revenueDelta / Math.max(result.baseline.revenueForecastSom, 1)) * 240 + result.levers.promoIntensityPct * 1.3, 0, 100),
      text: "How much demand impulse the modeled scene creates.",
      theme: "blue",
    },
    {
      label: "Ops pressure",
      value: clamp(100 - result.scenario.deliveryRatePct + result.scenario.cancelRatePct * 2.2 + result.scenario.leakageScore * 0.45, 0, 100),
      text: "Where the plan starts pushing against execution capacity.",
      theme: "amber",
    },
    {
      label: "Margin shield",
      value: clamp(
        72 +
          (result.scenario.savingsPotentialSom / Math.max(result.scenario.revenueForecastSom, 1)) * 280 -
          (result.scenario.leakageValueSom / Math.max(result.scenario.revenueForecastSom, 1)) * 160,
        0,
        100
      ),
      text: "How well the scene protects value after leakage and pricing pressure.",
      theme: "green",
    },
    {
      label: "Risk load",
      value:
        role === "buyer"
          ? clamp(result.scenario.supplierHhi * 110 + result.scenario.categoryHhi * 90, 0, 100)
          : clamp((100 - result.scenario.repeatRatePct) * 0.75 + result.scenario.leakageScore * 0.55, 0, 100),
      text: "Concentration, leakage and weak spots that stay inside the scenario.",
      theme: "red",
    },
  ];
}

export function buildScenarioDecisionCards(role: AppRole, result: WhatIfResponse | null | undefined): ScenarioDecisionCard[] {
  if (!result) return [];
  const revenueDelta = Number(result.delta.revenue_forecast_som || 0);
  const deliveryDelta = Number(result.delta.delivery_rate_pct || 0);
  const cancelDelta = Number(result.delta.cancel_rate_pct || 0);
  const retained = retainedValues(result);
  const leadDrilldown = result.drilldown.points[0];

  return [
    {
      kicker: "Primary move",
      title: revenueDelta >= 0 ? "There is modeled upside to capture" : "This scene is not producing enough upside yet",
      text:
        revenueDelta >= 0
          ? role === "buyer"
            ? "Move only if the supplier and delivery bottlenecks are handled first."
            : "Move only if operations can absorb the extra demand without amplifying leakage."
          : "Rework the lever mix around delivery, cancel and concentration pressure first.",
      tone: tone(revenueDelta),
    },
    {
      kicker: "Bottleneck",
      title: deliveryDelta >= 0 && cancelDelta <= 0 ? "Execution supports the scene" : "Execution is still the weak link",
      text:
        deliveryDelta >= 0 && cancelDelta <= 0
          ? "Delivery and cancellation signals are aligned with the intended upside."
          : "The plan still leaks through delivery instability or cancellation pressure.",
      tone: deliveryDelta >= 0 && cancelDelta <= 0 ? "up" : "down",
    },
    {
      kicker: "Shockwave",
      title: leadDrilldown ? `${leadDrilldown.key} is moving harder than the rest` : "Drilldown signal appears after simulation",
      text: leadDrilldown
        ? `This drilldown point shifts by ${leadDrilldown.deltaPct >= 0 ? "+" : ""}${leadDrilldown.deltaPct.toFixed(1)}% and defines the tone of the scene.`
        : "Run the simulation to see the strongest category or SKU movement.",
      tone: leadDrilldown ? tone(leadDrilldown.deltaPct) : "neutral",
    },
    {
      kicker: "Value capture",
      title: retained.delta >= 0 ? "Retained value is improving" : "Retained value is still eroding",
      text:
        role === "buyer"
          ? "Net retained value combines revenue, leakage and savings potential into one buyer-side signal."
          : "Net retained value combines revenue, leakage and recovery into one supplier-side signal.",
      tone: goodTone(retained.delta, "up"),
    },
  ];
}
