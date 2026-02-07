import { useEffect, useMemo, useState } from "react";
import { fetchAnalyticsSummary, type AnalyticsSummary } from "../api/analytics";
import TopHeader from "../ui/TopHeader";

type SeriesPoint = { label: string; value: number };
type MonthPoint = { month: string; label: string; value: number };

function linearRegression(points: SeriesPoint[]) {
  const n = points.length;
  const xs = points.map((_, i) => i + 1);
  const ys = points.map((p) => p.value);
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((a, b, i) => a + b * ys[i], 0);
  const sumX2 = xs.reduce((a, b) => a + b * b, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX || 1);
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

function forecast(points: SeriesPoint[], months: number) {
  const { slope, intercept } = linearRegression(points);
  const out: SeriesPoint[] = [];
  for (let i = 1; i <= months; i += 1) {
    const x = points.length + i;
    const value = Math.max(0, Math.round(intercept + slope * x));
    out.push({ label: `M+${i}`, value });
  }
  return out;
}

function formatK(num: number) {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return String(Math.round(num));
}

function parseMonthLabel(raw: string): string {
  if (!raw) return "";
  const parts = raw.split("-");
  if (parts.length < 2) return raw;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return raw;
  const fmt = new Intl.DateTimeFormat("ru-RU", { month: "short" });
  const label = fmt.format(new Date(y, m - 1, 1));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function statusLabel(status: string): string {
  const up = (status || "").toUpperCase();
  switch (up) {
    case "PENDING":
    case "CREATED":
      return "Новые";
    case "CONFIRMED":
      return "Подтверждены";
    case "DELIVERING":
      return "В пути";
    case "DELIVERED":
      return "Доставлены";
    case "CANCELLED":
    case "CANCELED":
      return "Отменены";
    default:
      return status;
  }
}

function calcDeltaPct(points: MonthPoint[], index: number): number | null {
  if (index <= 0 || index >= points.length) return null;
  const prev = points[index - 1].value;
  const cur = points[index].value;
  if (prev <= 0) return null;
  return ((cur - prev) / prev) * 100;
}

function formatDeltaShort(delta: number | null): string {
  if (delta == null) return "—";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)}%`;
}

export default function AnalyticsScreen({
  active,
  cartCount,
  onBurger,
  role,
  companyId,
  showCompanyBanner = false,
  onPickCompany,
}: {
  active: boolean;
  cartCount: number;
  onBurger: () => void;
  role?: string | null;
  companyId?: number | null;
  showCompanyBanner?: boolean;
  onPickCompany?: () => void;
}) {
  const isSupplier = role?.toLowerCase() === "supplier";
  const analyticsRole = isSupplier ? "supplier" : "buyer";

  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [marketFocusMonth, setMarketFocusMonth] = useState<string | null>(null);
  const [salesFocusMonth, setSalesFocusMonth] = useState<string | null>(null);

  useEffect(() => {
    if (!active || !companyId) return;
    let alive = true;
    setLoading(true);
    setError(false);

    fetchAnalyticsSummary({ companyId, role: analyticsRole, days: 365 })
      .then((res) => {
        if (!alive) return;
        setData(res);
      })
      .catch(() => {
        if (!alive) return;
        setError(true);
        setData(null);
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [active, companyId, analyticsRole]);

  const marketSeries = useMemo<MonthPoint[]>(() => {
    if (!data?.market_trends?.length) return [];
    return data.market_trends.map((x) => ({
      month: x.month,
      label: parseMonthLabel(x.month),
      value: Math.round(x.revenue ?? 0),
    }));
  }, [data]);

  const salesSeries = useMemo<MonthPoint[]>(() => {
    if (!data?.sales_trends?.length) return [];
    return data.sales_trends.map((x) => ({
      month: x.month,
      label: parseMonthLabel(x.month),
      value: Math.round(x.revenue ?? 0),
    }));
  }, [data]);

  useEffect(() => {
    if (!marketSeries.length) {
      setMarketFocusMonth(null);
      return;
    }
    if (!marketFocusMonth || !marketSeries.some((x) => x.month === marketFocusMonth)) {
      setMarketFocusMonth(marketSeries[marketSeries.length - 1].month);
    }
  }, [marketSeries, marketFocusMonth]);

  useEffect(() => {
    if (!salesSeries.length) {
      setSalesFocusMonth(null);
      return;
    }
    if (!salesFocusMonth || !salesSeries.some((x) => x.month === salesFocusMonth)) {
      setSalesFocusMonth(salesSeries[salesSeries.length - 1].month);
    }
  }, [salesSeries, salesFocusMonth]);

  const marketFocused = marketSeries.find((x) => x.month === marketFocusMonth) ?? null;
  const salesFocused = salesSeries.find((x) => x.month === salesFocusMonth) ?? null;
  const marketFocusedIndex = marketSeries.findIndex((x) => x.month === marketFocusMonth);
  const salesFocusedIndex = salesSeries.findIndex((x) => x.month === salesFocusMonth);
  const marketDelta = calcDeltaPct(marketSeries, marketFocusedIndex);
  const salesDelta = calcDeltaPct(salesSeries, salesFocusedIndex);

  const marketSeriesView = marketSeries.slice(-6);
  const salesSeriesView = salesSeries.slice(-6);
  const marketMax = Math.max(...marketSeriesView.map((x) => x.value), 1);
  const salesMax = Math.max(...salesSeriesView.map((x) => x.value), 1);

  useEffect(() => {
    if (!marketSeriesView.length) return;
    if (!marketFocusMonth || !marketSeriesView.some((x) => x.month === marketFocusMonth)) {
      setMarketFocusMonth(marketSeriesView[marketSeriesView.length - 1].month);
    }
  }, [marketSeriesView, marketFocusMonth]);

  useEffect(() => {
    if (!salesSeriesView.length) return;
    if (!salesFocusMonth || !salesSeriesView.some((x) => x.month === salesFocusMonth)) {
      setSalesFocusMonth(salesSeriesView[salesSeriesView.length - 1].month);
    }
  }, [salesSeriesView, salesFocusMonth]);

  const forecastSeries = useMemo(() => {
    const plain = salesSeries.map((x) => ({ label: x.label, value: x.value }));
    if (plain.length < 2) return [];
    return forecast(plain, 3);
  }, [salesSeries]);

  const avgCheck = data && data.total_orders > 0 ? Math.round(data.total_revenue / data.total_orders) : 0;
  const topCategories = (data?.category_breakdown ?? []).slice(0, 6);
  const funnelRows = (data?.status_funnel ?? []).filter((x) => x.count > 0);
  const insights = data?.insights ?? [];

  return (
    <section id="screen-analytics" className={`screen ${active ? "active" : ""}`}>
      <TopHeader onBurger={onBurger} badgeCount={cartCount} />
      <header className="simple-header">
        <div className="simple-title">Аналитика</div>
      </header>

      {showCompanyBanner ? (
        <div className="company-banner">
          <div>
            <div className="company-banner-title">Добавьте компанию</div>
            <div className="company-banner-text">Полная аналитика доступна после выбора компании.</div>
          </div>
          <button className="company-banner-btn" type="button" onClick={onPickCompany}>
            Выбрать
          </button>
        </div>
      ) : null}

      {!showCompanyBanner && (loading || error) ? (
        <div className="analytics-state">{loading ? "Загружаем аналитику..." : "Не удалось загрузить аналитику"}</div>
      ) : null}

      <div className="analytics-grid">
        <div className="analytic-card">
          <div className="analytic-title">Рынок</div>
          <div className="analytic-row">
            <div className="analytic-metric">
              <div className="metric-label">Выручка платформы</div>
              <div className="metric-value">{formatK(data?.market?.platform_revenue ?? 0)}</div>
            </div>
            <div className="analytic-metric">
              <div className="metric-label">Заказы платформы</div>
              <div className="metric-value">{data?.market?.platform_orders ?? 0}</div>
            </div>
            <div className="analytic-metric">
              <div className="metric-label">Доля компании</div>
              <div className="metric-value">{`${(data?.market?.company_share_pct ?? 0).toFixed(1)}%`}</div>
            </div>
          </div>

          <div className="analytic-subtitle">Динамика рынка по месяцам</div>
          <div className="analytics-month-strip">
            {marketSeriesView.map((p, idx) => {
              const height = Math.max(8, Math.round((p.value / marketMax) * 100));
              const activePoint = p.month === marketFocusMonth;
              const delta = calcDeltaPct(marketSeriesView, idx);
              const peakPct = Math.round((p.value / marketMax) * 100);
              return (
                <button
                  key={p.month}
                  type="button"
                  className={`analytics-month-card ${activePoint ? "active" : ""}`}
                  onClick={() => setMarketFocusMonth(p.month)}
                >
                  <div className="analytics-month-value">{formatK(p.value)}</div>
                  <div className="analytics-month-meta">
                    <span className={`analytics-trend ${delta == null ? "flat" : delta >= 0 ? "up" : "down"}`}>{formatDeltaShort(delta)}</span>
                    <span className="analytics-peak">{`${peakPct}% пик`}</span>
                  </div>
                  <div className="analytics-month-bar-wrap">
                    <div className="analytics-month-bar market" style={{ height: `${height}%` }} />
                  </div>
                  <div className="analytics-month-label">{p.label}</div>
                </button>
              );
            })}
          </div>
          {marketFocused && (
            <div className="analytics-selected-note">
              {`Выбрано: ${marketFocused.label} • ${formatK(marketFocused.value)} • ${
                marketDelta == null ? "без сравнения" : `${marketDelta >= 0 ? "+" : ""}${marketDelta.toFixed(1)}% к пред. месяцу`
              }`}
            </div>
          )}
        </div>

        <div className="analytic-card">
          <div className="analytic-title">{isSupplier ? "Продажи поставщика" : "Покупки компании"}</div>
          <div className="analytic-row">
            <div className="analytic-metric">
              <div className="metric-label">Выручка (за период)</div>
              <div className="metric-value">{formatK(data?.total_revenue ?? 0)}</div>
            </div>
            <div className="analytic-metric">
              <div className="metric-label">Средний чек</div>
              <div className="metric-value">{avgCheck > 0 ? avgCheck : "-"}</div>
            </div>
            <div className="analytic-metric">
              <div className="metric-label">Рост MoM</div>
              <div className="metric-value">
                {salesDelta == null ? "-" : `${salesDelta >= 0 ? "+" : ""}${salesDelta.toFixed(1)}%`}
              </div>
            </div>
          </div>

          <div className="analytic-subtitle">Динамика выручки по месяцам</div>
          <div className="analytics-month-strip">
            {salesSeriesView.map((p, idx) => {
              const height = Math.max(8, Math.round((p.value / salesMax) * 100));
              const activePoint = p.month === salesFocusMonth;
              const delta = calcDeltaPct(salesSeriesView, idx);
              const peakPct = Math.round((p.value / salesMax) * 100);
              return (
                <button
                  key={p.month}
                  type="button"
                  className={`analytics-month-card ${activePoint ? "active" : ""}`}
                  onClick={() => setSalesFocusMonth(p.month)}
                >
                  <div className="analytics-month-value">{formatK(p.value)}</div>
                  <div className="analytics-month-meta">
                    <span className={`analytics-trend ${delta == null ? "flat" : delta >= 0 ? "up" : "down"}`}>{formatDeltaShort(delta)}</span>
                    <span className="analytics-peak">{`${peakPct}% пик`}</span>
                  </div>
                  <div className="analytics-month-bar-wrap">
                    <div className="analytics-month-bar sales" style={{ height: `${height}%` }} />
                  </div>
                  <div className="analytics-month-label">{p.label}</div>
                </button>
              );
            })}
          </div>
          {salesFocused && (
            <div className="analytics-selected-note">
              {`Выбрано: ${salesFocused.label} • ${formatK(salesFocused.value)} • ${
                salesDelta == null ? "без сравнения" : `${salesDelta >= 0 ? "+" : ""}${salesDelta.toFixed(1)}% к пред. месяцу`
              }`}
            </div>
          )}
        </div>

        <div className="analytic-card">
          <div className="analytic-title">Прогноз продаж (регрессия)</div>
          <div className="analytic-subtitle">Следующие 3 месяца</div>
          <div className="forecast-row">
            {forecastSeries.length ? (
              forecastSeries.map((p) => (
                <div className="forecast-pill" key={p.label}>
                  <div className="forecast-label">{p.label}</div>
                  <div className="forecast-value">{formatK(p.value)}</div>
                </div>
              ))
            ) : (
              <div className="order-item-muted">Недостаточно данных для прогноза</div>
            )}
          </div>
          <div className="analytic-note">{`Модель: линейная регрессия по последним ${salesSeries.length} месяцам.`}</div>
        </div>

        <div className="analytic-card">
          <div className="analytic-title">Категории</div>
          <div className="stacked-list">
            {topCategories.length ? (
              topCategories.map((c) => (
                <div className="stacked-row" key={c.name}>
                  <div className="stacked-label">{c.name}</div>
                  <div className="stacked-bar">
                    <span style={{ width: `${Math.max(1, c.share_pct)}%` }} />
                  </div>
                  <div className="stacked-value">{`${c.share_pct.toFixed(0)}%`}</div>
                </div>
              ))
            ) : (
              <div className="order-item-muted">Нет данных по категориям</div>
            )}
          </div>
        </div>

        <div className="analytic-card">
          <div className="analytic-title">Воронка статусов</div>
          <div className="funnel">
            {funnelRows.length ? (
              funnelRows.map((f) => (
                <div className="funnel-row" key={f.status}>
                  <div className="funnel-label">{statusLabel(f.status)}</div>
                  <div className="funnel-value">{formatK(f.count)}</div>
                </div>
              ))
            ) : (
              <div className="order-item-muted">Нет заказов за период</div>
            )}
          </div>
        </div>

        <div className="analytic-card">
          <div className="analytic-title">Выводы и рекомендации</div>
          <ul className="analytic-list">
            {insights.length ? (
              insights.map((line, i) => <li key={`${line}-${i}`}>{line}</li>)
            ) : (
              <li>Пока нет достаточного объема данных для выводов</li>
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}
