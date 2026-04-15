import type { AppRole } from "@usc/core";

export function buildAnalyticsMonthPrompt(role: AppRole, month: string): string {
  const period = month.trim() || "the selected period";
  if (role === "supplier") {
    return `Explain our supplier performance for ${period}, identify the main bottleneck, and give the top actions for the next month.`;
  }
  return `Explain our buyer performance for ${period}, identify the main bottleneck, and give the top actions for the next month.`;
}
