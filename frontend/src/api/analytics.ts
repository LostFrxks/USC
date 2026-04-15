import { api, ensureAccessToken, forceLogout } from "./client";
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
  chat_session_id?: number;
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

export type WhatIfLevers = {
  delivery_improve_pp?: number;
  cancel_reduce_pp?: number;
  top_category_share_reduce_pp?: number;
  promo_intensity_pct?: number;
  cheaper_supplier_shift_pct?: number;
  reliable_supplier_shift_pct?: number;
  price_cut_overpriced_pct?: number;
  pipeline_recovery_pct?: number;
};

export type WhatIfMetrics = {
  horizon_days: number;
  periods: number;
  monthly_base_som: number;
  revenue_forecast_som: number;
  mom_pct: number | null;
  delivery_rate_pct: number;
  cancel_rate_pct: number;
  market_share_pct: number;
  top_category_name: string;
  top_category_share_pct: number;
  supplier_hhi: number;
  category_hhi: number;
  savings_potential_som: number;
  avg_watch_savings_pct: number;
  leakage_score: number;
  leakage_value_som: number;
  repeat_rate_pct: number;
};

export type WhatIfResponse = {
  role: "buyer" | "supplier";
  horizon_days: 30 | 60 | 90;
  selected_month: string | null;
  levers: Required<WhatIfLevers>;
  baseline: WhatIfMetrics;
  scenario: WhatIfMetrics;
  delta: Record<string, number | null>;
  compare_series: Array<{ period: string; baseline: number; scenario: number }>;
  drilldown: {
    by: "category" | "sku";
    points: Array<{ key: string; baseline: number; scenario: number; delta_pct: number }>;
  };
  drivers: string[];
  warnings: string[];
  confidence: number;
};

export type WhatIfScenario = {
  id: number;
  title: string;
  role: "buyer" | "supplier";
  horizon_days: number;
  selected_month: string | null;
  levers: Required<WhatIfLevers>;
  result: WhatIfResponse | null;
  created_at: string;
  updated_at: string;
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
  chatSessionId?: number | null;
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
      chat_session_id: params.chatSessionId ?? null,
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
    chatSessionId?: number | null;
  },
  handlers: {
    onStart?: () => void;
    onDelta?: (chunk: string) => void;
    signal?: AbortSignal;
  } = {}
): Promise<AnalyticsAssistantResponse> {
  const token = await ensureAccessToken();
  if (!token) {
    forceLogout("missing-token");
    throw new Error("Missing access token");
  }
  const res = await fetch(`${API_BASE}/analytics/assistant/query/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      company_id: params.companyId,
      role: params.role,
      question: params.question,
      days: params.days ?? 365,
      selected_month: params.selectedMonth ?? null,
      chat_session_id: params.chatSessionId ?? null,
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

export async function simulateWhatIf(params: {
  companyId: number;
  role: "buyer" | "supplier";
  days?: number;
  horizonDays: 30 | 60 | 90;
  selectedMonth?: string | null;
  drilldownBy?: "category" | "sku";
  levers: WhatIfLevers;
}) {
  return api<WhatIfResponse>("/analytics/what-if", {
    method: "POST",
    auth: true,
    body: {
      company_id: params.companyId,
      role: params.role,
      days: params.days ?? 365,
      horizon_days: params.horizonDays,
      selected_month: params.selectedMonth ?? null,
      drilldown_by: params.drilldownBy ?? "category",
      levers: params.levers,
    },
  });
}

export async function fetchWhatIfScenarios(params: {
  companyId: number;
  role: "buyer" | "supplier";
  limit?: number;
}) {
  const qs = new URLSearchParams();
  qs.set("company_id", String(params.companyId));
  qs.set("role", params.role);
  qs.set("limit", String(params.limit ?? 30));
  return api<{ items: WhatIfScenario[] }>(`/analytics/what-if/scenarios?${qs.toString()}`, { auth: true });
}

export async function createWhatIfScenario(params: {
  companyId: number;
  role: "buyer" | "supplier";
  title?: string | null;
  horizonDays: 30 | 60 | 90;
  selectedMonth?: string | null;
  levers: WhatIfLevers;
  result?: WhatIfResponse | null;
}) {
  return api<WhatIfScenario>("/analytics/what-if/scenarios", {
    method: "POST",
    auth: true,
    body: {
      company_id: params.companyId,
      role: params.role,
      title: params.title ?? null,
      horizon_days: params.horizonDays,
      selected_month: params.selectedMonth ?? null,
      levers: params.levers,
      result: params.result ?? null,
    },
  });
}

export async function renameWhatIfScenario(scenarioId: number, title: string) {
  return api<{ id: number; title: string; updated: boolean }>(`/analytics/what-if/scenarios/${scenarioId}`, {
    method: "PATCH",
    auth: true,
    body: { title },
  });
}

export async function deleteWhatIfScenario(scenarioId: number) {
  return api<{ deleted: boolean }>(`/analytics/what-if/scenarios/${scenarioId}`, {
    method: "DELETE",
    auth: true,
  });
}
