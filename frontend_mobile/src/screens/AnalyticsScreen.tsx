import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useSelectedCompany } from "@/session/SelectedCompanyProvider";
import { useSession } from "@/session/SessionProvider";
import { NotificationsAction } from "@/ui/AppHeaderAction";
import { DataRow, DataStack, HeroBanner, InsetPanel, MetaTag, SectionCard, StatGrid, StatTile } from "@/ui/BusinessUI";
import { EmptyState } from "@/ui/EmptyState";
import { Screen } from "@/ui/Screen";
import { buildAnalyticsMonthPrompt } from "@/screens/aiHandoff";
import { buildCategoryBars, buildFunnelBars, buildTrendBars } from "@/screens/analyticsVisuals";
import { palette } from "@/ui/theme";

function money(value: number): string {
  return `${Math.round(value).toLocaleString("en-US")} som`;
}

function pct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function severityLabel(level: "critical" | "warning" | "info"): string {
  if (level === "critical") return "Critical";
  if (level === "warning") return "Warning";
  return "Info";
}

function concentrationLabel(level: "low" | "medium" | "high"): string {
  if (level === "high") return "High";
  if (level === "medium") return "Medium";
  return "Low";
}

function statusShare(items: Array<{ status: string; count: number }>, statuses: string[]): number {
  const total = items.reduce((sum, item) => sum + item.count, 0);
  if (total <= 0) return 0;
  const matched = items.reduce((sum, item) => (statuses.includes(item.status.toUpperCase()) ? sum + item.count : sum), 0);
  return (matched / total) * 100;
}

function BarList({
  items,
  formatter,
  testID,
  testIDPrefix,
  onPressItem,
}: {
  items: Array<{ key: string; label: string; value: number; ratio: number; note?: string }>;
  formatter?: (value: number, note?: string) => string;
  testID?: string;
  testIDPrefix?: string;
  onPressItem?: (item: { key: string; label: string; value: number; ratio: number; note?: string }) => void;
}) {
  return (
    <View testID={testID} style={styles.barList}>
      {items.map((item, index) => (
        <Pressable
          key={item.key || item.label}
          testID={testIDPrefix ? `${testIDPrefix}-${index}` : undefined}
          style={({ pressed }) => [styles.barRowShell, pressed && styles.barRowPressed]}
          disabled={!onPressItem}
          onPress={() => onPressItem?.(item)}
        >
          <InsetPanel tone="neutral">
            <View style={styles.barRowHead}>
              <Text style={styles.rowTitle}>{item.label}</Text>
              <Text style={styles.footnote}>{formatter ? formatter(item.value, item.note) : String(item.value)}</Text>
            </View>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${Math.round(item.ratio * 100)}%` }]} />
            </View>
          </InsetPanel>
        </Pressable>
      ))}
    </View>
  );
}

export function AnalyticsScreen() {
  const { activeCompany, activeCompanyId, appRole } = useSelectedCompany();
  const { services } = useSession();

  const analyticsQuery = useQuery({
    queryKey: ["analytics", appRole, activeCompanyId],
    queryFn: () => services.analyticsApi.fetchSummary({ companyId: activeCompanyId as number, role: appRole, days: 365 }),
    enabled: Boolean(activeCompanyId),
  });

  const analytics = analyticsQuery.data;
  const topProducts = useMemo(() => analytics?.topProducts.slice(0, 5) ?? [], [analytics?.topProducts]);
  const topCategories = useMemo(() => analytics?.categoryBreakdown.slice(0, 5) ?? [], [analytics?.categoryBreakdown]);
  const statusFunnel = useMemo(() => analytics?.statusFunnel ?? [], [analytics?.statusFunnel]);
  const salesBars = useMemo(() => buildTrendBars(analytics?.salesTrends ?? []), [analytics?.salesTrends]);
  const marketBars = useMemo(() => buildTrendBars(analytics?.marketTrends ?? []), [analytics?.marketTrends]);
  const categoryBars = useMemo(() => buildCategoryBars(analytics?.categoryBreakdown ?? []), [analytics?.categoryBreakdown]);
  const funnelBars = useMemo(() => buildFunnelBars(statusFunnel), [statusFunnel]);
  const deliveredSharePct = useMemo(() => statusShare(statusFunnel, ["DELIVERED", "PARTIALLY_DELIVERED"]), [statusFunnel]);
  const cancelledSharePct = useMemo(() => statusShare(statusFunnel, ["CANCELLED", "FAILED"]), [statusFunnel]);
  const alerts = analytics?.analyticsModules?.alerts ?? [];
  const actions = analytics?.analyticsModules?.actions ?? [];
  const buyerModules = analytics?.analyticsModules?.buyer;
  const supplierModules = analytics?.analyticsModules?.supplier;
  const buyerRecommendations = analytics?.buyerRecommendations;

  return (
    <Screen
      testID="screen-analytics"
      title="Analytics"
      subtitle={activeCompany ? `${activeCompany.name} - ${appRole}` : "Company analytics"}
      headerRight={<NotificationsAction />}
    >
      {!activeCompanyId ? (
        <EmptyState title="No company selected" text="Choose an active company before opening analytics." />
      ) : analyticsQuery.isLoading ? (
        <EmptyState title="Loading analytics" text="Fetching current company metrics, trends and recommended actions." />
      ) : !analytics ? (
        <EmptyState title="Analytics unavailable" text="The summary endpoint did not return data for this company." />
      ) : (
        <View style={styles.stack}>
          <HeroBanner
            eyebrow="Analytics workspace"
            title={activeCompany?.name ?? "Analytics workspace"}
            text={`Role ${appRole}. Use trends, alerts and action modules to move from snapshot to decision.`}
            aside={<MetaTag label={appRole} tone="primary" />}
          />

          <StatGrid>
            <StatTile label="Revenue" value={money(analytics.totalRevenue)} />
            <StatTile label="Orders" value={analytics.totalOrders} />
            <StatTile label="Market share" value={pct(analytics.market.companySharePct)} />
            <StatTile label="Delivered" value={pct(deliveredSharePct)} tone="success" />
            <StatTile label="Cancelled" value={pct(cancelledSharePct)} tone="warning" />
          </StatGrid>

          <SectionCard title="Revenue trend" subtitle="Tap a month to continue the analysis in AI.">
            {salesBars.length === 0 ? (
              <Text style={styles.body}>No sales trend data is available yet.</Text>
            ) : (
              <BarList
                testID="analytics-sales-trend"
                testIDPrefix="analytics-sales-month"
                items={salesBars}
                formatter={(value) => money(value)}
                onPressItem={(item) =>
                  router.push({
                    pathname: "/(app)/ai",
                    params: {
                      month: item.key,
                      prompt: buildAnalyticsMonthPrompt(appRole, item.key),
                      autorun: "1",
                    },
                  })
                }
              />
            )}
          </SectionCard>

          <SectionCard title="Market trend" subtitle="Use a market month to open a focused AI explanation.">
            {marketBars.length === 0 ? (
              <Text style={styles.body}>No market trend series is available.</Text>
            ) : (
              <BarList
                testID="analytics-market-trend"
                testIDPrefix="analytics-market-month"
                items={marketBars}
                formatter={(value) => money(value)}
                onPressItem={(item) =>
                  router.push({
                    pathname: "/(app)/ai",
                    params: {
                      month: item.key,
                      prompt: buildAnalyticsMonthPrompt(appRole, item.key),
                      autorun: "1",
                    },
                  })
                }
              />
            )}
          </SectionCard>

          <SectionCard title="Insights">
            {(analytics.insights ?? []).length === 0 ? (
              <Text style={styles.body}>No insights returned for this company yet.</Text>
            ) : (
              <DataStack>
                {analytics.insights.map((insight, index) => (
                  <DataRow key={`${insight}-${index}`} title={`Signal ${index + 1}`} body={insight} />
                ))}
              </DataStack>
            )}
          </SectionCard>

          <SectionCard title="Alerts" subtitle="Highest-signal exceptions that need operator attention.">
            {alerts.length === 0 ? (
              <Text style={styles.body}>No active analytics alerts.</Text>
            ) : (
              <DataStack>
                {alerts.map((alert) => (
                  <DataRow
                    key={alert.id}
                    title={`${severityLabel(alert.severity)} - ${alert.title}`}
                    body={alert.message}
                    meta={alert.actionHint}
                    trailing={<MetaTag label={severityLabel(alert.severity)} tone={alert.severity === "critical" ? "danger" : alert.severity === "warning" ? "warning" : "neutral"} />}
                  />
                ))}
              </DataStack>
            )}
          </SectionCard>

          <SectionCard title="Priority actions" subtitle="Recommended next moves ranked by priority and confidence.">
            {actions.length === 0 ? (
              <Text style={styles.body}>No prioritized actions are available in the current analytics module payload.</Text>
            ) : (
              <DataStack>
                {actions.slice(0, 5).map((action) => (
                  <DataRow
                    key={action.id}
                    title={action.title}
                    body={action.rationale}
                    meta={`Confidence ${Math.round(action.confidence * 100)}%`}
                    trailing={<MetaTag label={`P${Math.round(action.priority)}`} tone="primary" />}
                  />
                ))}
              </DataStack>
            )}
          </SectionCard>

          <SectionCard title="Top products">
            {topProducts.length === 0 ? (
              <Text style={styles.body}>No top product rollup is available yet.</Text>
            ) : (
              <DataStack>
                {topProducts.map((product) => (
                  <DataRow
                    key={product.productId}
                    title={product.name}
                    body={`${money(product.revenue)} - qty ${Math.round(product.qtyTotal)}`}
                  />
                ))}
              </DataStack>
            )}
          </SectionCard>

          <SectionCard title="Category breakdown">
            {topCategories.length === 0 ? (
              <Text style={styles.body}>No category breakdown is available.</Text>
            ) : (
              <BarList
                testID="analytics-category-breakdown"
                items={categoryBars}
                formatter={(value, note) => `${pct(value)} - ${money(Number(note ?? 0))}`}
              />
            )}
          </SectionCard>

          <SectionCard title="Status funnel">
            {statusFunnel.length === 0 ? (
              <Text style={styles.body}>No status funnel data is available.</Text>
            ) : (
              <BarList testID="analytics-status-funnel" items={funnelBars} formatter={(value) => String(value)} />
            )}
          </SectionCard>

          {appRole === "buyer" ? (
            <>
              <SectionCard title="Cheaper alternatives">
                {(buyerRecommendations?.cheaperAlternatives ?? []).length === 0 ? (
                  <Text style={styles.body}>No cheaper alternatives returned for the active buyer company.</Text>
                ) : (
                  <DataStack>
                    {buyerRecommendations?.cheaperAlternatives.slice(0, 5).map((item) => (
                      <DataRow
                        key={`${item.anchorProductId}-${item.candidateProductId}`}
                        title={item.anchorProductName}
                        body={`${item.anchorSupplierName} -> ${item.candidateSupplierName}`}
                        meta={`${money(item.anchorPrice)} -> ${money(item.candidatePrice)} | Save ${money(item.savingsAbs)} (${pct(item.savingsPct)})`}
                      />
                    ))}
                  </DataStack>
                )}
              </SectionCard>

              <SectionCard title="Supplier reliability">
                {(buyerModules?.supplierReliability ?? buyerRecommendations?.reliableSuppliers ?? []).length === 0 ? (
                  <Text style={styles.body}>No supplier reliability rollup is available yet.</Text>
                ) : (
                  <DataStack>
                    {(buyerModules?.supplierReliability ?? buyerRecommendations?.reliableSuppliers ?? []).slice(0, 5).map((supplier) => (
                      <DataRow
                        key={supplier.supplierCompanyId}
                        title={supplier.supplierName}
                        body={`Score ${supplier.score} | Delivery ${pct(supplier.deliveryRatePct)} | Cancel ${pct(supplier.cancelRatePct)}`}
                      />
                    ))}
                  </DataStack>
                )}
              </SectionCard>

              <SectionCard title="Concentration">
                {buyerModules?.concentration ? (
                  <>
                    <View style={styles.inlineMetaRow}>
                      <MetaTag
                        label={`Risk ${concentrationLabel(buyerModules.concentration.riskLevel)}`}
                        tone={
                          buyerModules.concentration.riskLevel === "high"
                            ? "danger"
                            : buyerModules.concentration.riskLevel === "medium"
                              ? "warning"
                              : "success"
                        }
                      />
                    </View>
                    <StatGrid>
                      <StatTile label="Supplier HHI" value={buyerModules.concentration.supplierHhi.toFixed(2)} tone="neutral" />
                      <StatTile label="Category HHI" value={buyerModules.concentration.categoryHhi.toFixed(2)} tone="neutral" />
                    </StatGrid>
                    <BarList
                      items={[
                        {
                          key: "supplier-concentration",
                          label: "Supplier concentration",
                          value: buyerModules.concentration.supplierHhi,
                          ratio: Math.min(1, buyerModules.concentration.supplierHhi),
                        },
                        {
                          key: "category-concentration",
                          label: "Category concentration",
                          value: buyerModules.concentration.categoryHhi,
                          ratio: Math.min(1, buyerModules.concentration.categoryHhi),
                        },
                      ]}
                      formatter={(value) => value.toFixed(2)}
                    />
                  </>
                ) : (
                  <Text style={styles.body}>No concentration snapshot is available.</Text>
                )}
              </SectionCard>
            </>
          ) : (
            <>
              <SectionCard title="Price competitiveness">
                {supplierModules?.priceCompetitiveness ? (
                  <>
                    <StatGrid>
                      <StatTile label="Compared SKUs" value={supplierModules.priceCompetitiveness.skuCompared} tone="neutral" />
                      <StatTile label="Overpriced" value={pct(supplierModules.priceCompetitiveness.overpricedSharePct)} tone="warning" />
                      <StatTile label="Underpriced" value={pct(supplierModules.priceCompetitiveness.underpricedSharePct)} tone="success" />
                      <StatTile label="Median gap" value={pct(supplierModules.priceCompetitiveness.medianGapPct)} tone="neutral" />
                    </StatGrid>
                    {(supplierModules.priceCompetitiveness.topOverpricedSkus ?? []).length ? (
                      <DataStack>
                        {(supplierModules.priceCompetitiveness.topOverpricedSkus ?? []).slice(0, 3).map((sku) => (
                          <DataRow key={sku.productId} title={sku.name} body={`Gap ${pct(sku.gapPct)}`} />
                        ))}
                      </DataStack>
                    ) : null}
                  </>
                ) : (
                  <Text style={styles.body}>No price competitiveness data is available.</Text>
                )}
              </SectionCard>

              <SectionCard title="Buyer retention">
                {supplierModules?.buyerRetention ? (
                  <>
                    <StatGrid>
                      <StatTile label="New buyers" value={supplierModules.buyerRetention.newBuyers} tone="neutral" />
                      <StatTile label="Returning" value={supplierModules.buyerRetention.returningBuyers} tone="success" />
                      <StatTile label="At risk" value={supplierModules.buyerRetention.atRiskBuyers} tone="warning" />
                      <StatTile label="Repeat rate" value={pct(supplierModules.buyerRetention.repeatRatePct)} tone="primary" />
                    </StatGrid>
                    <BarList
                      items={[
                        {
                          key: "new",
                          label: "New",
                          value: supplierModules.buyerRetention.newBuyers,
                          ratio:
                            supplierModules.buyerRetention.newBuyers /
                            Math.max(
                              1,
                              supplierModules.buyerRetention.newBuyers +
                                supplierModules.buyerRetention.returningBuyers +
                                supplierModules.buyerRetention.atRiskBuyers
                            ),
                        },
                        {
                          key: "returning",
                          label: "Returning",
                          value: supplierModules.buyerRetention.returningBuyers,
                          ratio:
                            supplierModules.buyerRetention.returningBuyers /
                            Math.max(
                              1,
                              supplierModules.buyerRetention.newBuyers +
                                supplierModules.buyerRetention.returningBuyers +
                                supplierModules.buyerRetention.atRiskBuyers
                            ),
                        },
                        {
                          key: "at-risk",
                          label: "At risk",
                          value: supplierModules.buyerRetention.atRiskBuyers,
                          ratio:
                            supplierModules.buyerRetention.atRiskBuyers /
                            Math.max(
                              1,
                              supplierModules.buyerRetention.newBuyers +
                                supplierModules.buyerRetention.returningBuyers +
                                supplierModules.buyerRetention.atRiskBuyers
                            ),
                        },
                      ]}
                      formatter={(value) => String(value)}
                    />
                  </>
                ) : (
                  <Text style={styles.body}>No buyer retention metrics are available.</Text>
                )}
              </SectionCard>

              <SectionCard title="Revenue leakage">
                {supplierModules?.revenueLeakage ? (
                  <>
                    <StatGrid>
                      <StatTile label="Cancelled orders" value={supplierModules.revenueLeakage.cancelledOrders} tone="warning" />
                      <StatTile label="Cancelled value" value={money(supplierModules.revenueLeakage.cancelledValueEstimate)} tone="warning" />
                      <StatTile label="Pipeline orders" value={supplierModules.revenueLeakage.pipelineOrders} tone="neutral" />
                      <StatTile label="Pipeline value" value={money(supplierModules.revenueLeakage.pipelineValueEstimate)} tone="neutral" />
                    </StatGrid>
                    <View style={styles.inlineMetaRow}>
                      <MetaTag label={`Leakage score ${supplierModules.revenueLeakage.leakageScore}`} tone="danger" />
                    </View>
                  </>
                ) : (
                  <Text style={styles.body}>No revenue leakage module is available.</Text>
                )}
              </SectionCard>
            </>
          )}

          <Pressable testID="analytics-open-ai" onPress={() => router.push("/(app)/ai")}>
            <HeroBanner
              eyebrow="Next step"
              title="Open AI workspace"
              text="Ask questions about the current analytics context and run what-if experiments."
              aside={<MetaTag label="AI" tone="primary" />}
            />
          </Pressable>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 14,
  },
  barList: {
    gap: 12,
  },
  barRowShell: {
    gap: 6,
  },
  barRowPressed: {
    opacity: 0.88,
  },
  barRowHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
  },
  barTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: palette.bg,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: palette.primary,
    minWidth: 10,
  },
  body: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  rowTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: "700",
  },
  footnote: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  inlineMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
