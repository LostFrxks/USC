import type { AppRole, WhatIfResponse } from "@usc/core";
import type { ScenarioTheme, ScenarioTone } from "@/screens/aiScenarioInsights";
import { formatAnalyticsPeriod } from "@/screens/analyticsVisuals";

export type ScenarioMoneyFlowCard = {
  label: string;
  value: number;
  base: number;
  note: string;
  theme: ScenarioTheme;
  valueRatio: number;
  baseRatio: number;
};

export type ScenarioAct = {
  period: string;
  delta: number;
  intensity: number;
  title: string;
  tone: ScenarioTone;
};

export type ScenarioCascadeNode = {
  eyebrow: string;
  title: string;
  base: string;
  live: string;
  delta: string;
  note: string;
  tone: ScenarioTone;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function tone(value: number): ScenarioTone {
  return value > 0 ? "up" : value < 0 ? "down" : "neutral";
}

function safeMax(values: number[]): number {
  const max = Math.max(...values, 0);
  return max > 0 ? max : 1;
}

function normalizeRatio(value: number, max: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.max(0.08, Math.min(1, value / max));
}

function retainedValue(result: WhatIfResponse, side: "baseline" | "scenario"): number {
  const metrics = side === "baseline" ? result.baseline : result.scenario;
  return metrics.revenueForecastSom - metrics.leakageValueSom + metrics.savingsPotentialSom;
}

function signedCompact(value: number): string {
  return `${value >= 0 ? "+" : ""}${compactMoney(value)}`;
}

export function compactMoney(value: number): string {
  const n = Number.isFinite(value) ? value : 0;
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M som`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}k som`;
  return `${Math.round(n)} som`;
}

export function buildScenarioMoneyFlowCards(role: AppRole, result: WhatIfResponse | null | undefined): ScenarioMoneyFlowCard[] {
  if (!result) return [];
  const cards = [
    {
      label: role === "buyer" ? "Budget in motion" : "Demand entering",
      value: result.scenario.revenueForecastSom,
      base: result.baseline.revenueForecastSom,
      note: "Overall size of the modeled scene.",
      theme: "blue" as const,
    },
    {
      label: "Value delivered",
      value: result.scenario.revenueForecastSom * (result.scenario.deliveryRatePct / 100),
      base: result.baseline.revenueForecastSom * (result.baseline.deliveryRatePct / 100),
      note: "What actually survives into fulfilment.",
      theme: "green" as const,
    },
    {
      label: "Leakage",
      value: result.scenario.leakageValueSom,
      base: result.baseline.leakageValueSom,
      note: "Value that still leaks out of the scene.",
      theme: "red" as const,
    },
    {
      label: role === "buyer" ? "Protected value" : "Retained value",
      value: retainedValue(result, "scenario"),
      base: retainedValue(result, "baseline"),
      note: "Net value after leakage and savings/recovery effects.",
      theme: "gold" as const,
    },
  ];
  const max = safeMax(cards.flatMap((item) => [item.value, item.base]));
  return cards.map((item) => ({
    ...item,
    valueRatio: normalizeRatio(item.value, max),
    baseRatio: normalizeRatio(item.base, max),
  }));
}

export function buildScenarioCascadeNodes(role: AppRole, result: WhatIfResponse | null | undefined): ScenarioCascadeNode[] {
  if (!result) return [];
  const revenueDelta = Number(result.delta.revenue_forecast_som || 0);
  const deliveryDelta = Number(result.delta.delivery_rate_pct || 0);
  const leakageDelta = Number(result.delta.leakage_value_som || 0);
  const retainedBaseline = retainedValue(result, "baseline");
  const retainedScenario = retainedValue(result, "scenario");
  const retainedDelta = retainedScenario - retainedBaseline;

  return [
    {
      eyebrow: "Demand pulse",
      title: role === "buyer" ? "Procurement demand" : "Sales potential",
      base: compactMoney(result.baseline.revenueForecastSom),
      live: compactMoney(result.scenario.revenueForecastSom),
      delta: signedCompact(revenueDelta),
      note: `Market share ${result.baseline.marketSharePct.toFixed(1)}% -> ${result.scenario.marketSharePct.toFixed(1)}%.`,
      tone: tone(revenueDelta),
    },
    {
      eyebrow: "Fulfilment",
      title: "Execution",
      base: `${result.baseline.deliveryRatePct.toFixed(1)}%`,
      live: `${result.scenario.deliveryRatePct.toFixed(1)}%`,
      delta: `${deliveryDelta >= 0 ? "+" : ""}${deliveryDelta.toFixed(1)} pp`,
      note: `Delivery pressure ${deliveryDelta >= 0 ? "eases" : "rises"} with the scene.`,
      tone: deliveryDelta >= 0 ? "up" : "down",
    },
    {
      eyebrow: "Leakage",
      title: role === "buyer" ? "Losses and cancellations" : "Operational leakage",
      base: compactMoney(result.baseline.leakageValueSom),
      live: compactMoney(result.scenario.leakageValueSom),
      delta: signedCompact(leakageDelta),
      note: `Cancel ${result.baseline.cancelRatePct.toFixed(1)}% -> ${result.scenario.cancelRatePct.toFixed(1)}%.`,
      tone: leakageDelta <= 0 ? "up" : "down",
    },
    {
      eyebrow: "Value capture",
      title: role === "buyer" ? "Protected value" : "Retained value",
      base: compactMoney(retainedBaseline),
      live: compactMoney(retainedScenario),
      delta: signedCompact(retainedDelta),
      note:
        role === "buyer"
          ? `Savings potential ${compactMoney(result.scenario.savingsPotentialSom)}.`
          : `Repeat rate ${result.scenario.repeatRatePct.toFixed(1)}%.`,
      tone: tone(retainedDelta),
    },
  ];
}

export function buildScenarioActs(result: WhatIfResponse | null | undefined): ScenarioAct[] {
  if (!result?.compareSeries?.length) return [];
  return result.compareSeries.map((point, index, series) => {
    const prev = index === 0 ? point.baseline : series[index - 1].scenario;
    const delta = point.scenario - prev;
    const intensity = clamp((Math.abs(delta) / Math.max(point.scenario, point.baseline, 1)) * 320, 12, 100);
    let title = "Stability window";
    if (delta >= 0) title = index === 0 ? "Demand ignition" : index === series.length - 1 ? "Profit capture" : "Growth release";
    if (delta < 0) title = Math.abs(delta) > Math.max(point.scenario, 1) * 0.14 ? "Stress spike" : "Friction pocket";
    return {
      period: formatAnalyticsPeriod(point.period),
      delta,
      intensity,
      title,
      tone: tone(delta),
    };
  });
}
