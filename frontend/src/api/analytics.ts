import { api } from "./client";
import { API_BASE } from "../config";

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
  analytics_modules?: {
    generated_at: string;
    alerts: Array<{
      id: string;
      severity: "critical" | "warning" | "info";
      title: string;
      message: string;
      metric_key: string;
      metric_value: number | string;
      threshold?: number | string;
      action_hint: string;
    }>;
    actions: Array<{
      id: string;
      priority: number;
      title: string;
      rationale: string;
      expected_impact_abs?: number;
      expected_impact_pct?: number;
      confidence: number;
      owner: "buyer" | "supplier";
    }>;
    buyer?: {
      savings_watchlist: Array<{
        anchor_product_id: number;
        anchor_product_name: string;
        current_supplier_name: string;
        current_price: number;
        alt_supplier_name: string;
        alt_product_name: string;
        alt_price: number;
        savings_abs: number;
        savings_pct: number;
      }>;
      supplier_reliability: Array<{
        supplier_company_id: number;
        supplier_name: string;
        score: number;
        delivery_rate_pct: number;
        cancel_rate_pct: number;
        repeat_share_pct: number;
        delivered_orders: number;
      }>;
      concentration: {
        supplier_hhi: number;
        category_hhi: number;
        risk_level: "low" | "medium" | "high";
      };
    };
    supplier?: {
      price_competitiveness: {
        sku_compared: number;
        overpriced_share_pct: number;
        underpriced_share_pct: number;
        median_gap_pct: number;
        top_overpriced_skus: Array<{ product_id: number; name: string; gap_pct: number }>;
      };
      buyer_retention: {
        new_buyers: number;
        returning_buyers: number;
        at_risk_buyers: number;
        repeat_rate_pct: number;
      };
      revenue_leakage: {
        cancelled_orders: number;
        cancelled_value_estimate: number;
        pipeline_orders: number;
        pipeline_value_estimate: number;
        leakage_score: number;
      };
    };
  };
  buyer_recommendations?: {
    cheaper_alternatives: Array<{
      anchor_product_id: number;
      anchor_product_name: string;
      anchor_supplier_company_id: number;
      anchor_supplier_name: string;
      anchor_price: number;
      candidate_product_id: number;
      candidate_product_name: string;
      candidate_supplier_company_id: number;
      candidate_supplier_name: string;
      candidate_price: number;
      unit: string;
      savings_abs: number;
      savings_pct: number;
      rationale: string;
    }>;
    reliable_suppliers: Array<{
      supplier_company_id: number;
      supplier_name: string;
      score: number;
      delivery_rate_pct: number;
      cancel_rate_pct: number;
      repeat_share_pct: number;
      delivered_orders: number;
    }>;
    generated_at: string;
  };
};

export type AnalyticsAssistantResponse = {
  summary: string;
  probable_causes: string[];
  actions: string[];
  confidence: number;
  focus_month: string | null;
  show_metrics?: boolean;
  metrics: {
    mom_pct: number | null;
    delivery_rate_pct: number;
    cancel_rate_pct: number;
    market_share_pct: number;
    top_category_name: string;
    top_category_share_pct: number;
  };
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

export async function queryAnalyticsAssistant(params: {
  companyId: number;
  role: "supplier" | "buyer";
  question: string;
  days?: number;
  selectedMonth?: string | null;
}) {
  return api<AnalyticsAssistantResponse>("/analytics/assistant/query", {
    method: "POST",
    auth: true,
    body: {
      company_id: params.companyId,
      role: params.role,
      question: params.question,
      days: params.days ?? 365,
      selected_month: params.selectedMonth ?? null,
    },
  });
}

export async function streamAnalyticsAssistant(
  params: {
    companyId: number;
    role: "supplier" | "buyer";
    question: string;
    days?: number;
    selectedMonth?: string | null;
  },
  handlers: {
    onStart?: () => void;
    onDelta?: (chunk: string) => void;
    signal?: AbortSignal;
  } = {}
): Promise<AnalyticsAssistantResponse> {
  const token = localStorage.getItem("usc_access_token");
  const res = await fetch(`${API_BASE}/analytics/assistant/query/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      company_id: params.companyId,
      role: params.role,
      question: params.question,
      days: params.days ?? 365,
      selected_month: params.selectedMonth ?? null,
    }),
    signal: handlers.signal,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`AI stream failed: ${res.status} ${txt}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("AI stream unavailable");
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let started = false;
  let donePayload: AnalyticsAssistantResponse | null = null;

  const processLine = (lineRaw: string) => {
    const line = lineRaw.trim();
    if (!line) return;
    let parsed: any;
    try {
      parsed = JSON.parse(line);
    } catch {
      return;
    }
    const type = String(parsed?.type || "");
    if (type === "start") {
      if (!started) handlers.onStart?.();
      started = true;
      return;
    }
    if (type === "delta") {
      handlers.onDelta?.(String(parsed?.text || ""));
      return;
    }
    if (type === "done" && parsed?.data) {
      donePayload = parsed.data as AnalyticsAssistantResponse;
      return;
    }
    if (type === "error") {
      throw new Error(String(parsed?.message || "AI stream error"));
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) processLine(line);
  }
  buffer += decoder.decode();
  if (buffer.trim()) processLine(buffer);

  if (!donePayload) throw new Error("AI stream finished without payload");
  return donePayload;
}
