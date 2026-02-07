import { api } from "./client";

export type AnalyticsSummary = {
  company_id: number;
  role: "supplier" | "buyer";
  days: number;
  total_orders: number;
  total_revenue: number;
  daily_revenue: Array<{ day: string; revenue: number }>;
  top_products: Array<{ product_id: number; name: string; revenue: number; qty_total: number }>;
  market: {
    platform_revenue: number;
    platform_orders: number;
    company_share_pct: number;
  };
  market_trends: Array<{ month: string; revenue: number }>;
  sales_trends: Array<{ month: string; revenue: number }>;
  category_breakdown: Array<{ name: string; revenue: number; share_pct: number }>;
  status_funnel: Array<{ status: string; count: number }>;
  insights: string[];
};

export async function fetchAnalyticsSummary(params: {
  companyId: number;
  role: "supplier" | "buyer";
  days?: number;
}) {
  const qs = new URLSearchParams();
  qs.set("company_id", String(params.companyId));
  qs.set("role", params.role);
  if (params.days) qs.set("days", String(params.days));
  return api<AnalyticsSummary>(`/analytics/summary/?${qs.toString()}`, { auth: true });
}
