import { createAiChatApi, createAnalyticsApi, type Transport } from "@usc/core";

function makeTransport(handler: (path: string, options?: { method?: string; body?: unknown; auth?: boolean }) => unknown): Transport {
  return {
    request<T>(path: string, options?: { method?: string; body?: unknown; auth?: boolean }) {
      return Promise.resolve(handler(path, options) as T);
    },
  };
}

describe("mobile analytics and AI client normalization", () => {
  it("normalizes analytics summary payload", async () => {
    const api = createAnalyticsApi(
      makeTransport(() => ({
        company_id: 10,
        role: "buyer",
        days: 365,
        total_orders: 4,
        total_revenue: 1200,
        daily_revenue: [{ day: "2026-04-01", revenue: 1200 }],
        top_products: [{ product_id: 1, name: "Milk", revenue: 500, qty_total: 10 }],
        market: { platform_revenue: 9000, platform_orders: 120, company_share_pct: 13.4 },
        market_trends: [{ month: "2026-03", revenue: 800 }],
        sales_trends: [{ month: "2026-03", revenue: 700 }],
        category_breakdown: [{ name: "Dairy", revenue: 700, share_pct: 58.3 }],
        status_funnel: [{ status: "DELIVERED", count: 3 }],
        insights: ["Demand is stable"],
        analytics_modules: {
          generated_at: "2026-04-02T12:00:00Z",
          alerts: [
            {
              id: "a1",
              severity: "warning",
              title: "Delivery slowdown",
              message: "Delivery rate slipped this week.",
              metric_key: "delivery_rate_pct",
              metric_value: 92.5,
              threshold: 95,
              action_hint: "Check supplier SLA and courier load.",
            },
          ],
          actions: [
            {
              id: "act1",
              priority: 88,
              title: "Shift demand to safer suppliers",
              rationale: "Reliability gap is rising.",
              expected_impact_abs: 1500,
              confidence: 0.8,
              owner: "buyer",
            },
          ],
          buyer: {
            savings_watchlist: [
              {
                anchor_product_id: 1,
                anchor_product_name: "Milk",
                current_supplier_name: "Supplier A",
                current_price: 120,
                alt_supplier_name: "Supplier B",
                alt_product_name: "Milk Alt",
                alt_price: 110,
                savings_abs: 10,
                savings_pct: 8.3,
              },
            ],
            supplier_reliability: [
              {
                supplier_company_id: 20,
                supplier_name: "Supplier A",
                score: 87,
                delivery_rate_pct: 95,
                cancel_rate_pct: 2,
                repeat_share_pct: 60,
                delivered_orders: 31,
              },
            ],
            concentration: {
              supplier_hhi: 0.42,
              category_hhi: 0.35,
              risk_level: "medium",
            },
          },
        },
        buyer_recommendations: {
          cheaper_alternatives: [
            {
              anchor_product_id: 1,
              anchor_product_name: "Milk",
              anchor_supplier_company_id: 20,
              anchor_supplier_name: "Supplier A",
              anchor_price: 120,
              candidate_product_id: 2,
              candidate_product_name: "Milk Alt",
              candidate_supplier_company_id: 21,
              candidate_supplier_name: "Supplier B",
              candidate_price: 110,
              unit: "pcs",
              savings_abs: 10,
              savings_pct: 8.3,
              rationale: "Equivalent product at lower price",
            },
          ],
          reliable_suppliers: [
            {
              supplier_company_id: 20,
              supplier_name: "Supplier A",
              score: 87,
              delivery_rate_pct: 95,
              cancel_rate_pct: 2,
              repeat_share_pct: 60,
              delivered_orders: 31,
            },
          ],
          generated_at: "2026-04-02T12:00:00Z",
        },
      }))
    );

    const result = await api.fetchSummary({ companyId: 10, role: "buyer", days: 365 });
    expect(result.companyId).toBe(10);
    expect(result.topProducts[0]).toEqual({ productId: 1, name: "Milk", revenue: 500, qtyTotal: 10 });
    expect(result.market.companySharePct).toBe(13.4);
    expect(result.analyticsModules?.alerts[0].metricKey).toBe("delivery_rate_pct");
    expect(result.analyticsModules?.buyer?.savingsWatchlist[0].anchorProductName).toBe("Milk");
    expect(result.analyticsModules?.buyer?.concentration.riskLevel).toBe("medium");
    expect(result.buyerRecommendations?.cheaperAlternatives[0].candidateSupplierName).toBe("Supplier B");
  });

  it("normalizes what-if responses and scenarios", async () => {
    const payload = {
      role: "supplier",
      horizon_days: 30,
      selected_month: "2026-03",
      levers: {
        delivery_improve_pp: 3,
        cancel_reduce_pp: 2,
        top_category_share_reduce_pp: 0,
        promo_intensity_pct: 5,
        cheaper_supplier_shift_pct: 0,
        reliable_supplier_shift_pct: 0,
        price_cut_overpriced_pct: 4,
        pipeline_recovery_pct: 6,
      },
      baseline: {
        horizon_days: 30,
        periods: 3,
        monthly_base_som: 100,
        revenue_forecast_som: 1000,
        mom_pct: 2,
        delivery_rate_pct: 95,
        cancel_rate_pct: 3,
        market_share_pct: 10,
        top_category_name: "Dairy",
        top_category_share_pct: 40,
        supplier_hhi: 0.2,
        category_hhi: 0.3,
        savings_potential_som: 90,
        avg_watch_savings_pct: 5,
        leakage_score: 12,
        leakage_value_som: 40,
        repeat_rate_pct: 55,
      },
      scenario: {
        horizon_days: 30,
        periods: 3,
        monthly_base_som: 120,
        revenue_forecast_som: 1300,
        mom_pct: 4,
        delivery_rate_pct: 97,
        cancel_rate_pct: 2,
        market_share_pct: 12,
        top_category_name: "Dairy",
        top_category_share_pct: 42,
        supplier_hhi: 0.2,
        category_hhi: 0.3,
        savings_potential_som: 120,
        avg_watch_savings_pct: 6,
        leakage_score: 10,
        leakage_value_som: 20,
        repeat_rate_pct: 60,
      },
      delta: { revenue_forecast_som: 300 },
      compare_series: [{ period: "P1", baseline: 1000, scenario: 1300 }],
      drilldown: { by: "category", points: [{ key: "Dairy", baseline: 1000, scenario: 1300, delta_pct: 30 }] },
      drivers: ["Improve delivery"],
      warnings: ["Watch stock"],
      confidence: 0.8,
    };

    const api = createAnalyticsApi(
      makeTransport((path) => {
        if (path.startsWith("/analytics/what-if/scenarios?")) {
          return { items: [{ id: 1, title: "Scenario 1", created_at: "2026-04-02", updated_at: "2026-04-02", ...payload, result: payload }] };
        }
        return payload;
      })
    );

    const simulate = await api.simulateWhatIf({
      companyId: 11,
      role: "supplier",
      horizonDays: 30,
      levers: { deliveryImprovePp: 3, cancelReducePp: 2, promoIntensityPct: 5, priceCutOverpricedPct: 4, pipelineRecoveryPct: 6 },
    });
    expect(simulate.compareSeries[0]).toEqual({ period: "P1", baseline: 1000, scenario: 1300 });
    expect(simulate.drilldown.points[0].deltaPct).toBe(30);

    const scenarios = await api.fetchWhatIfScenarios({ companyId: 11, role: "supplier" });
    expect(scenarios.items[0].result?.scenario.revenueForecastSom).toBe(1300);
  });

  it("normalizes AI chat sessions", async () => {
    const api = createAiChatApi(
      makeTransport(() => ({
        sessions: [
          {
            id: 5,
            title: "Margin check",
            created_at: "2026-04-02T09:00:00Z",
            updated_at: "2026-04-02T09:10:00Z",
            last_message_at: "2026-04-02T09:10:00Z",
            message_count: 2,
            preview: "Look at the margin delta",
            messages: [
              {
                id: 11,
                role: "assistant",
                text: "Check supplier pricing.",
                created_at: "2026-04-02T09:10:00Z",
                payload: {
                  summary: "Check supplier pricing.",
                  probable_causes: [],
                  actions: [],
                  confidence: 0.7,
                  focus_month: null,
                  metrics: {
                    mom_pct: null,
                    delivery_rate_pct: 90,
                    cancel_rate_pct: 3,
                    market_share_pct: 10,
                    top_category_name: "Dairy",
                    top_category_share_pct: 40,
                  },
                },
              },
            ],
          },
        ],
        current_id: 5,
      }))
    );

    const result = await api.listSessions({ companyId: 10, role: "buyer" });
    expect(result.currentId).toBe(5);
    expect(result.sessions[0].messages[0].payload?.summary).toBe("Check supplier pricing.");
  });

  it("streams analytics assistant responses", async () => {
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode(JSON.stringify({ type: "start" }) + "\n"));
        controller.enqueue(encoder.encode(JSON.stringify({ type: "delta", text: "Hello " }) + "\n"));
        controller.enqueue(encoder.encode(JSON.stringify({ type: "delta", text: "world" }) + "\n"));
        controller.enqueue(
          encoder.encode(
            JSON.stringify({
              type: "done",
              data: {
                summary: "Hello world",
                probable_causes: ["Cause A"],
                actions: ["Action A"],
                confidence: 0.9,
                focus_month: null,
                chat_session_id: 5,
                metrics: {
                  mom_pct: 1.2,
                  delivery_rate_pct: 97,
                  cancel_rate_pct: 2,
                  market_share_pct: 11,
                  top_category_name: "Dairy",
                  top_category_share_pct: 40,
                },
              },
            }) + "\n"
          )
        );
        controller.close();
      },
    });

    const onDelta = jest.fn();
    const api = createAnalyticsApi(makeTransport(() => ({})), {
      baseUrl: "https://example.com/api",
      ensureAccessToken: async () => "access-token",
      fetchImpl: jest.fn(async (url: string, options?: RequestInit) => {
        expect(url).toBe("https://example.com/api/analytics/assistant/query/stream");
        expect(options?.headers).toMatchObject({
          Authorization: "Bearer access-token",
        });
        return {
          ok: true,
          status: 200,
          body: stream,
          text: async () => "",
        } as Response;
      }) as typeof fetch,
    });

    const result = await api.streamAssistant(
      {
        companyId: 10,
        role: "buyer",
        question: "What happened?",
      },
      { onDelta }
    );

    expect(onDelta).toHaveBeenCalledWith("Hello ");
    expect(onDelta).toHaveBeenCalledWith("world");
    expect(result.summary).toBe("Hello world");
    expect(result.chatSessionId).toBe(5);
    expect(result.actions[0]).toBe("Action A");
  });
});
