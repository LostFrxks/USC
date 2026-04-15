import type { WhatIfResponse } from "@usc/core";
import { formatAnalyticsPeriod } from "@/screens/analyticsVisuals";

export type ScenarioCompareBar = {
  label: string;
  baseline: number;
  scenario: number;
  baselineRatio: number;
  scenarioRatio: number;
};

export type ScenarioDrilldownBar = {
  label: string;
  baseline: number;
  scenario: number;
  deltaPct: number;
  ratio: number;
};

function safeMax(values: number[]): number {
  const max = Math.max(...values, 0);
  return max > 0 ? max : 1;
}

function normalizeRatio(value: number, max: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.max(0.08, Math.min(1, value / max));
}

export function buildScenarioCompareBars(result: WhatIfResponse | null | undefined, maxItems = 6): ScenarioCompareBar[] {
  const selected = (result?.compareSeries ?? []).slice(-maxItems);
  const max = safeMax(selected.flatMap((item) => [item.baseline, item.scenario]));
  return selected.map((item) => ({
    label: formatAnalyticsPeriod(item.period),
    baseline: item.baseline,
    scenario: item.scenario,
    baselineRatio: normalizeRatio(item.baseline, max),
    scenarioRatio: normalizeRatio(item.scenario, max),
  }));
}

export function buildScenarioDrilldownBars(result: WhatIfResponse | null | undefined, maxItems = 5): ScenarioDrilldownBar[] {
  const selected = (result?.drilldown.points ?? []).slice(0, maxItems);
  const max = safeMax(selected.map((item) => Math.max(item.baseline, item.scenario)));
  return selected.map((item) => ({
    label: item.key,
    baseline: item.baseline,
    scenario: item.scenario,
    deltaPct: item.deltaPct,
    ratio: normalizeRatio(Math.max(item.baseline, item.scenario), max),
  }));
}

export function scenarioDeltaLabel(value: number | null | undefined, suffix = ""): string {
  if (value == null || !Number.isFinite(value)) return "n/a";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}${suffix}`;
}
