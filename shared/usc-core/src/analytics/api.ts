import type {
  AnalyticsAction,
  AnalyticsAlert,
  AnalyticsAssistantResponse,
  AnalyticsModules,
  AnalyticsSummary,
  AppRole,
  BuyerRecommendations,
  BuyerSupplierReliabilityItem,
  WhatIfLevers,
  WhatIfMetrics,
  WhatIfResponse,
  WhatIfScenario,
} from "../types/domain";
import type { Transport } from "../transport/contracts";

type FetchLike = typeof fetch;

type AnalyticsStreamHandlers = {
  onStart?: () => void;
  onDelta?: (chunk: string) => void;
  signal?: AbortSignal;
};

type AnalyticsApiStreamOptions = {
  baseUrl: string;
  ensureAccessToken: () => Promise<string | null>;
  fetchImpl?: FetchLike;
};

function normalizeAlerts(data: any[] | undefined): AnalyticsAlert[] {
  return (data ?? []).map((item) => ({
    id: item.id,
    severity: item.severity,
    title: item.title,
    message: item.message,
    metricKey: item.metric_key,
    metricValue: item.metric_value,
    threshold: item.threshold,
    actionHint: item.action_hint,
  }));
}

function normalizeActions(data: any[] | undefined): AnalyticsAction[] {
  return (data ?? []).map((item) => ({
    id: item.id,
    priority: item.priority,
    title: item.title,
    rationale: item.rationale,
    expectedImpactAbs: item.expected_impact_abs,
    expectedImpactPct: item.expected_impact_pct,
    confidence: item.confidence,
    owner: item.owner,
  }));
}

function normalizeSupplierReliability(data: any[] | undefined): BuyerSupplierReliabilityItem[] {
  return (data ?? []).map((item) => ({
    supplierCompanyId: item.supplier_company_id,
    supplierName: item.supplier_name,
    score: item.score,
    deliveryRatePct: item.delivery_rate_pct,
    cancelRatePct: item.cancel_rate_pct,
    repeatSharePct: item.repeat_share_pct,
    deliveredOrders: item.delivered_orders,
  }));
}

function normalizeAnalyticsModules(data: any | undefined): AnalyticsModules | undefined {
  if (!data) return undefined;
  return {
    generatedAt: data.generated_at ?? "",
    alerts: normalizeAlerts(data.alerts),
    actions: normalizeActions(data.actions),
    buyer: data.buyer
      ? {
          savingsWatchlist: (data.buyer.savings_watchlist ?? []).map((item: any) => ({
            anchorProductId: item.anchor_product_id,
            anchorProductName: item.anchor_product_name,
            currentSupplierName: item.current_supplier_name,
            currentPrice: item.current_price,
            altSupplierName: item.alt_supplier_name,
            altProductName: item.alt_product_name,
            altPrice: item.alt_price,
            savingsAbs: item.savings_abs,
            savingsPct: item.savings_pct,
          })),
          supplierReliability: normalizeSupplierReliability(data.buyer.supplier_reliability),
          concentration: {
            supplierHhi: data.buyer.concentration?.supplier_hhi ?? 0,
            categoryHhi: data.buyer.concentration?.category_hhi ?? 0,
            riskLevel: data.buyer.concentration?.risk_level ?? "low",
          },
        }
      : undefined,
    supplier: data.supplier
      ? {
          priceCompetitiveness: {
            skuCompared: data.supplier.price_competitiveness?.sku_compared ?? 0,
            overpricedSharePct: data.supplier.price_competitiveness?.overpriced_share_pct ?? 0,
            underpricedSharePct: data.supplier.price_competitiveness?.underpriced_share_pct ?? 0,
            medianGapPct: data.supplier.price_competitiveness?.median_gap_pct ?? 0,
            topOverpricedSkus: (data.supplier.price_competitiveness?.top_overpriced_skus ?? []).map((item: any) => ({
              productId: item.product_id,
              name: item.name,
              gapPct: item.gap_pct,
            })),
          },
          buyerRetention: {
            newBuyers: data.supplier.buyer_retention?.new_buyers ?? 0,
            returningBuyers: data.supplier.buyer_retention?.returning_buyers ?? 0,
            atRiskBuyers: data.supplier.buyer_retention?.at_risk_buyers ?? 0,
            repeatRatePct: data.supplier.buyer_retention?.repeat_rate_pct ?? 0,
          },
          revenueLeakage: {
            cancelledOrders: data.supplier.revenue_leakage?.cancelled_orders ?? 0,
            cancelledValueEstimate: data.supplier.revenue_leakage?.cancelled_value_estimate ?? 0,
            pipelineOrders: data.supplier.revenue_leakage?.pipeline_orders ?? 0,
            pipelineValueEstimate: data.supplier.revenue_leakage?.pipeline_value_estimate ?? 0,
            leakageScore: data.supplier.revenue_leakage?.leakage_score ?? 0,
          },
        }
      : undefined,
  };
}

function normalizeBuyerRecommendations(data: any | undefined): BuyerRecommendations | undefined {
  if (!data) return undefined;
  return {
    cheaperAlternatives: (data.cheaper_alternatives ?? []).map((item: any) => ({
      anchorProductId: item.anchor_product_id,
      anchorProductName: item.anchor_product_name,
      anchorSupplierCompanyId: item.anchor_supplier_company_id,
      anchorSupplierName: item.anchor_supplier_name,
      anchorPrice: item.anchor_price,
      candidateProductId: item.candidate_product_id,
      candidateProductName: item.candidate_product_name,
      candidateSupplierCompanyId: item.candidate_supplier_company_id,
      candidateSupplierName: item.candidate_supplier_name,
      candidatePrice: item.candidate_price,
      unit: item.unit,
      savingsAbs: item.savings_abs,
      savingsPct: item.savings_pct,
      rationale: item.rationale,
    })),
    reliableSuppliers: normalizeSupplierReliability(data.reliable_suppliers),
    generatedAt: data.generated_at ?? "",
  };
}

function normalizeAssistantResponse(data: any): AnalyticsAssistantResponse {
  return {
    summary: data.summary ?? "",
    probableCauses: data.probable_causes ?? [],
    actions: data.actions ?? [],
    confidence: data.confidence ?? 0,
    focusMonth: data.focus_month ?? null,
    chatSessionId: data.chat_session_id,
    showMetrics: data.show_metrics,
    metrics: {
      momPct: data.metrics?.mom_pct ?? null,
      deliveryRatePct: data.metrics?.delivery_rate_pct ?? 0,
      cancelRatePct: data.metrics?.cancel_rate_pct ?? 0,
      marketSharePct: data.metrics?.market_share_pct ?? 0,
      topCategoryName: data.metrics?.top_category_name ?? "",
      topCategorySharePct: data.metrics?.top_category_share_pct ?? 0,
    },
  };
}

function normalizeWhatIfMetrics(data: any): WhatIfMetrics {
  return {
    horizonDays: data?.horizon_days ?? 0,
    periods: data?.periods ?? 0,
    monthlyBaseSom: data?.monthly_base_som ?? 0,
    revenueForecastSom: data?.revenue_forecast_som ?? 0,
    momPct: data?.mom_pct ?? null,
    deliveryRatePct: data?.delivery_rate_pct ?? 0,
    cancelRatePct: data?.cancel_rate_pct ?? 0,
    marketSharePct: data?.market_share_pct ?? 0,
    topCategoryName: data?.top_category_name ?? "",
    topCategorySharePct: data?.top_category_share_pct ?? 0,
    supplierHhi: data?.supplier_hhi ?? 0,
    categoryHhi: data?.category_hhi ?? 0,
    savingsPotentialSom: data?.savings_potential_som ?? 0,
    avgWatchSavingsPct: data?.avg_watch_savings_pct ?? 0,
    leakageScore: data?.leakage_score ?? 0,
    leakageValueSom: data?.leakage_value_som ?? 0,
    repeatRatePct: data?.repeat_rate_pct ?? 0,
  };
}

function normalizeWhatIfResponse(data: any): WhatIfResponse {
  return {
    role: data?.role ?? "buyer",
    horizonDays: data?.horizon_days ?? 30,
    selectedMonth: data?.selected_month ?? null,
    levers: {
      deliveryImprovePp: data?.levers?.delivery_improve_pp ?? 0,
      cancelReducePp: data?.levers?.cancel_reduce_pp ?? 0,
      topCategoryShareReducePp: data?.levers?.top_category_share_reduce_pp ?? 0,
      promoIntensityPct: data?.levers?.promo_intensity_pct ?? 0,
      cheaperSupplierShiftPct: data?.levers?.cheaper_supplier_shift_pct ?? 0,
      reliableSupplierShiftPct: data?.levers?.reliable_supplier_shift_pct ?? 0,
      priceCutOverpricedPct: data?.levers?.price_cut_overpriced_pct ?? 0,
      pipelineRecoveryPct: data?.levers?.pipeline_recovery_pct ?? 0,
    },
    baseline: normalizeWhatIfMetrics(data?.baseline),
    scenario: normalizeWhatIfMetrics(data?.scenario),
    delta: data?.delta ?? {},
    compareSeries: (data?.compare_series ?? []).map((item: any) => ({
      period: item.period,
      baseline: item.baseline,
      scenario: item.scenario,
    })),
    drilldown: {
      by: data?.drilldown?.by ?? "category",
      points: (data?.drilldown?.points ?? []).map((item: any) => ({
        key: item.key,
        baseline: item.baseline,
        scenario: item.scenario,
        deltaPct: item.delta_pct,
      })),
    },
    drivers: data?.drivers ?? [],
    warnings: data?.warnings ?? [],
    confidence: data?.confidence ?? 0,
  };
}

function normalizeWhatIfScenario(data: any): WhatIfScenario {
  return {
    id: data.id,
    title: data.title,
    role: data.role,
    horizonDays: data.horizon_days,
    selectedMonth: data.selected_month ?? null,
    levers: {
      deliveryImprovePp: data?.levers?.delivery_improve_pp ?? 0,
      cancelReducePp: data?.levers?.cancel_reduce_pp ?? 0,
      topCategoryShareReducePp: data?.levers?.top_category_share_reduce_pp ?? 0,
      promoIntensityPct: data?.levers?.promo_intensity_pct ?? 0,
      cheaperSupplierShiftPct: data?.levers?.cheaper_supplier_shift_pct ?? 0,
      reliableSupplierShiftPct: data?.levers?.reliable_supplier_shift_pct ?? 0,
      priceCutOverpricedPct: data?.levers?.price_cut_overpriced_pct ?? 0,
      pipelineRecoveryPct: data?.levers?.pipeline_recovery_pct ?? 0,
    },
    result: data.result ? normalizeWhatIfResponse(data.result) : null,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export function createAnalyticsApi(transport: Transport, streamOptions?: AnalyticsApiStreamOptions) {
  return {
    async fetchSummary(params: { companyId: number; role: AppRole; days?: number }): Promise<AnalyticsSummary> {
      const qs = new URLSearchParams();
      qs.set("company_id", String(params.companyId));
      qs.set("role", params.role);
      if (params.days) qs.set("days", String(params.days));
      const data = await transport.request<any>(`/analytics/summary/?${qs.toString()}`, { auth: true });
      return {
        companyId: data.company_id,
        role: data.role,
        days: data.days,
        totalOrders: data.total_orders,
        totalRevenue: data.total_revenue,
        dailyRevenue: data.daily_revenue ?? [],
        topProducts: (data.top_products ?? []).map((item: any) => ({
          productId: item.product_id,
          name: item.name,
          revenue: item.revenue,
          qtyTotal: item.qty_total,
        })),
        market: {
          platformRevenue: data.market?.platform_revenue ?? 0,
          platformOrders: data.market?.platform_orders ?? 0,
          companySharePct: data.market?.company_share_pct ?? 0,
        },
        marketTrends: data.market_trends ?? [],
        salesTrends: data.sales_trends ?? [],
        categoryBreakdown: (data.category_breakdown ?? []).map((item: any) => ({
          name: item.name,
          revenue: item.revenue,
          sharePct: item.share_pct,
        })),
        statusFunnel: data.status_funnel ?? [],
        insights: data.insights ?? [],
        analyticsModules: normalizeAnalyticsModules(data.analytics_modules),
        buyerRecommendations: normalizeBuyerRecommendations(data.buyer_recommendations),
      };
    },

    async queryAssistant(params: {
      companyId: number;
      role: AppRole;
      question: string;
      days?: number;
      selectedMonth?: string | null;
      chatSessionId?: number | null;
    }): Promise<AnalyticsAssistantResponse> {
      const data = await transport.request<any>("/analytics/assistant/query", {
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
      return normalizeAssistantResponse(data);
    },

    async streamAssistant(
      params: {
        companyId: number;
        role: AppRole;
        question: string;
        days?: number;
        selectedMonth?: string | null;
        chatSessionId?: number | null;
      },
      handlers: AnalyticsStreamHandlers = {}
    ): Promise<AnalyticsAssistantResponse> {
      if (!streamOptions) {
        throw new Error("Analytics stream is not configured.");
      }

      const token = await streamOptions.ensureAccessToken();
      if (!token) {
        throw new Error("Missing access token");
      }

      const fetchImpl = streamOptions.fetchImpl ?? fetch;
      const response = await fetchImpl(`${streamOptions.baseUrl.replace(/\/+$/, "")}/analytics/assistant/query/stream`, {
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

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`AI stream failed: ${response.status} ${text}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("AI stream unavailable");
      }

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
          donePayload = normalizeAssistantResponse(parsed.data);
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

      if (!donePayload) {
        throw new Error("AI stream finished without payload");
      }
      return donePayload;
    },

    fetchWhatIfScenarios(params: { companyId: number; role: AppRole; limit?: number }): Promise<{ items: WhatIfScenario[] }> {
      const qs = new URLSearchParams();
      qs.set("company_id", String(params.companyId));
      qs.set("role", params.role);
      qs.set("limit", String(params.limit ?? 30));
      return transport.request<{ items: any[] }>(`/analytics/what-if/scenarios?${qs.toString()}`, { auth: true }).then((data) => ({
        items: (data.items ?? []).map(normalizeWhatIfScenario),
      }));
    },

    async simulateWhatIf(params: {
      companyId: number;
      role: AppRole;
      days?: number;
      horizonDays: 30 | 60 | 90;
      selectedMonth?: string | null;
      drilldownBy?: "category" | "sku";
      levers: WhatIfLevers;
    }): Promise<WhatIfResponse> {
      const data = await transport.request<any>("/analytics/what-if", {
        method: "POST",
        auth: true,
        body: {
          company_id: params.companyId,
          role: params.role,
          days: params.days ?? 365,
          horizon_days: params.horizonDays,
          selected_month: params.selectedMonth ?? null,
          drilldown_by: params.drilldownBy ?? "category",
          levers: {
            delivery_improve_pp: params.levers.deliveryImprovePp ?? 0,
            cancel_reduce_pp: params.levers.cancelReducePp ?? 0,
            top_category_share_reduce_pp: params.levers.topCategoryShareReducePp ?? 0,
            promo_intensity_pct: params.levers.promoIntensityPct ?? 0,
            cheaper_supplier_shift_pct: params.levers.cheaperSupplierShiftPct ?? 0,
            reliable_supplier_shift_pct: params.levers.reliableSupplierShiftPct ?? 0,
            price_cut_overpriced_pct: params.levers.priceCutOverpricedPct ?? 0,
            pipeline_recovery_pct: params.levers.pipelineRecoveryPct ?? 0,
          },
        },
      });
      return normalizeWhatIfResponse(data);
    },

    async createWhatIfScenario(params: {
      companyId: number;
      role: AppRole;
      title?: string | null;
      horizonDays: 30 | 60 | 90;
      selectedMonth?: string | null;
      levers: WhatIfLevers;
      result?: WhatIfResponse | null;
    }): Promise<WhatIfScenario> {
      const data = await transport.request<any>("/analytics/what-if/scenarios", {
        method: "POST",
        auth: true,
        body: {
          company_id: params.companyId,
          role: params.role,
          title: params.title ?? null,
          horizon_days: params.horizonDays,
          selected_month: params.selectedMonth ?? null,
          levers: {
            delivery_improve_pp: params.levers.deliveryImprovePp ?? 0,
            cancel_reduce_pp: params.levers.cancelReducePp ?? 0,
            top_category_share_reduce_pp: params.levers.topCategoryShareReducePp ?? 0,
            promo_intensity_pct: params.levers.promoIntensityPct ?? 0,
            cheaper_supplier_shift_pct: params.levers.cheaperSupplierShiftPct ?? 0,
            reliable_supplier_shift_pct: params.levers.reliableSupplierShiftPct ?? 0,
            price_cut_overpriced_pct: params.levers.priceCutOverpricedPct ?? 0,
            pipeline_recovery_pct: params.levers.pipelineRecoveryPct ?? 0,
          },
          result: params.result
            ? {
                role: params.result.role,
                horizon_days: params.result.horizonDays,
                selected_month: params.result.selectedMonth,
                levers: {
                  delivery_improve_pp: params.result.levers.deliveryImprovePp ?? 0,
                  cancel_reduce_pp: params.result.levers.cancelReducePp ?? 0,
                  top_category_share_reduce_pp: params.result.levers.topCategoryShareReducePp ?? 0,
                  promo_intensity_pct: params.result.levers.promoIntensityPct ?? 0,
                  cheaper_supplier_shift_pct: params.result.levers.cheaperSupplierShiftPct ?? 0,
                  reliable_supplier_shift_pct: params.result.levers.reliableSupplierShiftPct ?? 0,
                  price_cut_overpriced_pct: params.result.levers.priceCutOverpricedPct ?? 0,
                  pipeline_recovery_pct: params.result.levers.pipelineRecoveryPct ?? 0,
                },
                baseline: {
                  horizon_days: params.result.baseline.horizonDays,
                  periods: params.result.baseline.periods,
                  monthly_base_som: params.result.baseline.monthlyBaseSom,
                  revenue_forecast_som: params.result.baseline.revenueForecastSom,
                  mom_pct: params.result.baseline.momPct,
                  delivery_rate_pct: params.result.baseline.deliveryRatePct,
                  cancel_rate_pct: params.result.baseline.cancelRatePct,
                  market_share_pct: params.result.baseline.marketSharePct,
                  top_category_name: params.result.baseline.topCategoryName,
                  top_category_share_pct: params.result.baseline.topCategorySharePct,
                  supplier_hhi: params.result.baseline.supplierHhi,
                  category_hhi: params.result.baseline.categoryHhi,
                  savings_potential_som: params.result.baseline.savingsPotentialSom,
                  avg_watch_savings_pct: params.result.baseline.avgWatchSavingsPct,
                  leakage_score: params.result.baseline.leakageScore,
                  leakage_value_som: params.result.baseline.leakageValueSom,
                  repeat_rate_pct: params.result.baseline.repeatRatePct,
                },
                scenario: {
                  horizon_days: params.result.scenario.horizonDays,
                  periods: params.result.scenario.periods,
                  monthly_base_som: params.result.scenario.monthlyBaseSom,
                  revenue_forecast_som: params.result.scenario.revenueForecastSom,
                  mom_pct: params.result.scenario.momPct,
                  delivery_rate_pct: params.result.scenario.deliveryRatePct,
                  cancel_rate_pct: params.result.scenario.cancelRatePct,
                  market_share_pct: params.result.scenario.marketSharePct,
                  top_category_name: params.result.scenario.topCategoryName,
                  top_category_share_pct: params.result.scenario.topCategorySharePct,
                  supplier_hhi: params.result.scenario.supplierHhi,
                  category_hhi: params.result.scenario.categoryHhi,
                  savings_potential_som: params.result.scenario.savingsPotentialSom,
                  avg_watch_savings_pct: params.result.scenario.avgWatchSavingsPct,
                  leakage_score: params.result.scenario.leakageScore,
                  leakage_value_som: params.result.scenario.leakageValueSom,
                  repeat_rate_pct: params.result.scenario.repeatRatePct,
                },
                delta: params.result.delta,
                compare_series: params.result.compareSeries.map((item) => ({
                  period: item.period,
                  baseline: item.baseline,
                  scenario: item.scenario,
                })),
                drilldown: {
                  by: params.result.drilldown.by,
                  points: params.result.drilldown.points.map((item) => ({
                    key: item.key,
                    baseline: item.baseline,
                    scenario: item.scenario,
                    delta_pct: item.deltaPct,
                  })),
                },
                drivers: params.result.drivers,
                warnings: params.result.warnings,
                confidence: params.result.confidence,
              }
            : null,
        },
      });
      return normalizeWhatIfScenario(data);
    },

    renameWhatIfScenario(scenarioId: number, title: string) {
      return transport.request<{ id: number; title: string; updated: boolean }>(`/analytics/what-if/scenarios/${scenarioId}`, {
        method: "PATCH",
        auth: true,
        body: { title },
      });
    },

    deleteWhatIfScenario(scenarioId: number) {
      return transport.request<{ deleted: boolean }>(`/analytics/what-if/scenarios/${scenarioId}`, {
        method: "DELETE",
        auth: true,
      });
    },
  };
}
