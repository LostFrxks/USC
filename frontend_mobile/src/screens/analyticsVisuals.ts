type ValuePoint = {
  key: string;
  label: string;
  value: number;
  note?: string;
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

export function formatAnalyticsPeriod(input: string): string {
  if (!input) return "";
  if (/^\d{4}-\d{2}$/.test(input)) {
    const [year, month] = input.split("-").map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "short" });
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(input)) {
    const date = new Date(input);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
  }
  return input;
}

export function buildTrendBars(points: Array<{ month?: string; day?: string; revenue: number }>, maxItems = 6): ValuePoint[] {
  const selected = points.slice(-maxItems);
  const max = safeMax(selected.map((item) => item.revenue));
  return selected.map((item) => ({
    key: item.month ?? item.day ?? "",
    label: formatAnalyticsPeriod(item.month ?? item.day ?? ""),
    value: item.revenue,
    ratio: normalizeRatio(item.revenue, max),
  }));
}

export function buildCategoryBars(points: Array<{ name: string; revenue: number; sharePct: number }>, maxItems = 5): ValuePoint[] {
  const selected = points.slice(0, maxItems);
  const max = safeMax(selected.map((item) => item.sharePct));
  return selected.map((item) => ({
    key: item.name,
    label: item.name,
    value: item.sharePct,
    note: String(Math.round(item.revenue)),
    ratio: normalizeRatio(item.sharePct, max),
  }));
}

export function buildFunnelBars(points: Array<{ status: string; count: number }>): ValuePoint[] {
  const max = safeMax(points.map((item) => item.count));
  return points.map((item) => ({
    key: item.status,
    label: item.status,
    value: item.count,
    ratio: normalizeRatio(item.count, max),
  }));
}
