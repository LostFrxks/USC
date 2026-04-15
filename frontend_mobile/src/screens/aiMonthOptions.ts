import { formatAnalyticsPeriod } from "@/screens/analyticsVisuals";

export type AiMonthOption = {
  value: string;
  label: string;
};

export function buildAiMonthOptions(points: Array<{ month: string; revenue: number }>, limit = 6): AiMonthOption[] {
  const seen = new Set<string>();
  const ordered = [...points]
    .map((item) => String(item.month || "").trim())
    .filter((value) => value.length > 0)
    .filter((value) => {
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });

  return ordered.slice(-limit).map((value) => ({
    value,
    label: formatAnalyticsPeriod(value),
  }));
}
