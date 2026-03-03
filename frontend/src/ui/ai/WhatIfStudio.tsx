import { useEffect, useMemo, useRef, useState } from "react";
import {
  createWhatIfScenario,
  deleteWhatIfScenario,
  fetchWhatIfScenarios,
  renameWhatIfScenario,
  simulateWhatIf,
  type WhatIfLevers,
  type WhatIfResponse,
  type WhatIfScenario,
} from "../../api/analytics";

type ToastTone = "info" | "success" | "error";

type LeverKey = keyof Required<WhatIfLevers>;
type LeverConfig = {
  key: LeverKey;
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  suffix: string;
};

const DEFAULT_LEVERS: Required<WhatIfLevers> = {
  delivery_improve_pp: 0,
  cancel_reduce_pp: 0,
  top_category_share_reduce_pp: 0,
  promo_intensity_pct: 0,
  cheaper_supplier_shift_pct: 0,
  reliable_supplier_shift_pct: 0,
  price_cut_overpriced_pct: 0,
  pipeline_recovery_pct: 0,
};

const COMMON_LEVERS: LeverConfig[] = [
  {
    key: "delivery_improve_pp",
    label: "Повысить долю доставленных заказов",
    hint: "Если сервис доставки станет стабильнее.",
    min: 0,
    max: 20,
    step: 1,
    suffix: "п.п.",
  },
  {
    key: "cancel_reduce_pp",
    label: "Снизить отмены",
    hint: "Если лучше подтверждать и доводить заказы до конца.",
    min: 0,
    max: 15,
    step: 0.5,
    suffix: "п.п.",
  },
  {
    key: "top_category_share_reduce_pp",
    label: "Убрать зависимость от одной категории",
    hint: "Если расширите ассортимент за пределы топ-категории.",
    min: 0,
    max: 25,
    step: 1,
    suffix: "п.п.",
  },
  {
    key: "promo_intensity_pct",
    label: "Усилить промо",
    hint: "Скидки, акции и маркетинг для роста оборота.",
    min: 0,
    max: 20,
    step: 1,
    suffix: "%",
  },
];

const BUYER_LEVERS: LeverConfig[] = [
  {
    key: "cheaper_supplier_shift_pct",
    label: "Перевести часть закупок к более дешевому поставщику",
    hint: "Снижает закупочную цену, но важно контролировать качество.",
    min: 0,
    max: 100,
    step: 5,
    suffix: "%",
  },
  {
    key: "reliable_supplier_shift_pct",
    label: "Перевести часть закупок к более надежному поставщику",
    hint: "Снижает риск срыва поставок и отмен.",
    min: 0,
    max: 100,
    step: 5,
    suffix: "%",
  },
];

const SUPPLIER_LEVERS: LeverConfig[] = [
  {
    key: "price_cut_overpriced_pct",
    label: "Снизить цену у переоцененных SKU",
    hint: "Ускоряет продажи, но может уменьшить маржу.",
    min: 0,
    max: 20,
    step: 1,
    suffix: "%",
  },
  {
    key: "pipeline_recovery_pct",
    label: "Ускорить перевод заказов из pipeline в delivered",
    hint: "Фокус на подтверждении, отгрузке и доведении заказа до доставки.",
    min: 0,
    max: 60,
    step: 5,
    suffix: "%",
  },
];

function formatMoney(value: number): string {
  if (!Number.isFinite(value)) return "0 сом";
  return `${Math.round(value).toLocaleString("ru-RU")} сом`;
}

function formatPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const rounded = Math.round(value * 100) / 100;
  if (Math.abs(rounded - Math.round(rounded)) < 0.001) return `${Math.round(rounded)}%`;
  return `${rounded.toFixed(2)}%`;
}

function deltaClass(delta: number): string {
  if (delta > 0) return "up";
  if (delta < 0) return "down";
  return "neutral";
}

function signedValue(value: number, digits = 1): string {
  if (!Number.isFinite(value) || value === 0) return "0";
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}`;
}

function normalizeDeltaTone(delta: number, improveWhen: "up" | "down"): "up" | "down" | "neutral" {
  if (!delta) return "neutral";
  if (improveWhen === "up") return delta > 0 ? "up" : "down";
  return delta < 0 ? "up" : "down";
}

function normalizeRole(role?: string | null): "buyer" | "supplier" {
  return (role || "").toLowerCase() === "supplier" ? "supplier" : "buyer";
}

export default function WhatIfStudio({
  companyId,
  role,
  onNotify,
  onDiscussScenario,
}: {
  companyId?: number | null;
  role?: string | null;
  onNotify: (text: string, tone?: ToastTone) => void;
  onDiscussScenario?: (text: string) => void;
}) {
  const analyticsRole = normalizeRole(role);
  const [horizonDays, setHorizonDays] = useState<30 | 60 | 90>(30);
  const [drilldownBy, setDrilldownBy] = useState<"category" | "sku">("category");
  const [levers, setLevers] = useState<Required<WhatIfLevers>>(DEFAULT_LEVERS);
  const [result, setResult] = useState<WhatIfResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [scenariosLoading, setScenariosLoading] = useState(false);
  const [scenarios, setScenarios] = useState<WhatIfScenario[]>([]);
  const requestSeq = useRef(0);
  const debounceRef = useRef<number | null>(null);

  const leverConfigs = useMemo(() => {
    return analyticsRole === "buyer"
      ? [...COMMON_LEVERS, ...BUYER_LEVERS]
      : [...COMMON_LEVERS, ...SUPPLIER_LEVERS];
  }, [analyticsRole]);

  const visibleMetricCards = useMemo(() => {
    if (!result) return [];
    const cards = [
      {
        key: "revenue",
        title: "Прогноз выручки",
        hint: "Сколько денег можно получить за выбранный период.",
        baseline: formatMoney(result.baseline.revenue_forecast_som),
        scenario: formatMoney(result.scenario.revenue_forecast_som),
        delta: Number(result.delta.revenue_forecast_som || 0),
        deltaLabel: `${Number(result.delta.revenue_forecast_som || 0) >= 0 ? "+" : ""}${formatMoney(Number(result.delta.revenue_forecast_som || 0))}`,
        improveWhen: "up" as const,
      },
      {
        key: "delivery",
        title: "Доставленные заказы",
        hint: "Доля заказов, дошедших до статуса DELIVERED.",
        baseline: formatPct(result.baseline.delivery_rate_pct),
        scenario: formatPct(result.scenario.delivery_rate_pct),
        delta: Number(result.delta.delivery_rate_pct || 0),
        deltaLabel: `${signedValue(Number(result.delta.delivery_rate_pct || 0), 1)} п.п.`,
        improveWhen: "up" as const,
      },
      {
        key: "cancel",
        title: "Отмены",
        hint: "Чем ниже показатель, тем лучше.",
        baseline: formatPct(result.baseline.cancel_rate_pct),
        scenario: formatPct(result.scenario.cancel_rate_pct),
        delta: Number(result.delta.cancel_rate_pct || 0),
        deltaLabel: `${signedValue(Number(result.delta.cancel_rate_pct || 0), 1)} п.п.`,
        improveWhen: "down" as const,
      },
      {
        key: "share",
        title: "Доля на платформе",
        hint: "Ваш вклад в оборот площадки.",
        baseline: formatPct(result.baseline.market_share_pct),
        scenario: formatPct(result.scenario.market_share_pct),
        delta: Number(result.delta.market_share_pct || 0),
        deltaLabel: `${signedValue(Number(result.delta.market_share_pct || 0), 1)} п.п.`,
        improveWhen: "up" as const,
      },
    ];
    if (analyticsRole === "buyer") {
      cards.push({
        key: "supplier_hhi",
        title: "Зависимость от поставщиков (HHI)",
        hint: "Чем ниже, тем меньше риск зависимости от 1-2 поставщиков.",
        baseline: String(result.baseline.supplier_hhi.toFixed(3)),
        scenario: String(result.scenario.supplier_hhi.toFixed(3)),
        delta: Number(result.delta.supplier_hhi || 0),
        deltaLabel: `${(result.delta.supplier_hhi || 0) >= 0 ? "+" : ""}${Number(result.delta.supplier_hhi || 0).toFixed(3)}`,
        improveWhen: "down" as const,
      });
    } else {
      cards.push({
        key: "leakage",
        title: "Операционные потери",
        hint: "Оценка потерь из-за отмен и незакрытого pipeline.",
        baseline: String(result.baseline.leakage_score.toFixed(1)),
        scenario: String(result.scenario.leakage_score.toFixed(1)),
        delta: Number(result.delta.leakage_score || 0),
        deltaLabel: `${result.delta.leakage_score || 0 >= 0 ? "+" : ""}${Number(result.delta.leakage_score || 0).toFixed(1)}`,
        improveWhen: "down" as const,
      });
    }
    return cards;
  }, [analyticsRole, result]);

  const revenueDelta = Number(result?.delta?.revenue_forecast_som || 0);
  const confidencePct = Math.round(Number(result?.confidence || 0) * 100);
  const applyPreset = (mode: "soft" | "balanced" | "boost") => {
    const base: Required<WhatIfLevers> = { ...DEFAULT_LEVERS };
    if (mode === "soft") {
      base.delivery_improve_pp = 2;
      base.cancel_reduce_pp = 1;
      base.top_category_share_reduce_pp = 2;
      base.promo_intensity_pct = 3;
      if (analyticsRole === "buyer") {
        base.cheaper_supplier_shift_pct = 10;
        base.reliable_supplier_shift_pct = 10;
      } else {
        base.price_cut_overpriced_pct = 3;
        base.pipeline_recovery_pct = 10;
      }
    }
    if (mode === "balanced") {
      base.delivery_improve_pp = 5;
      base.cancel_reduce_pp = 2;
      base.top_category_share_reduce_pp = 4;
      base.promo_intensity_pct = 7;
      if (analyticsRole === "buyer") {
        base.cheaper_supplier_shift_pct = 20;
        base.reliable_supplier_shift_pct = 20;
      } else {
        base.price_cut_overpriced_pct = 6;
        base.pipeline_recovery_pct = 20;
      }
    }
    if (mode === "boost") {
      base.delivery_improve_pp = 9;
      base.cancel_reduce_pp = 4;
      base.top_category_share_reduce_pp = 8;
      base.promo_intensity_pct = 12;
      if (analyticsRole === "buyer") {
        base.cheaper_supplier_shift_pct = 35;
        base.reliable_supplier_shift_pct = 30;
      } else {
        base.price_cut_overpriced_pct = 10;
        base.pipeline_recovery_pct = 30;
      }
    }
    setLevers(base);
  };

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    setScenariosLoading(true);
    void fetchWhatIfScenarios({ companyId, role: analyticsRole, limit: 30 })
      .then((res) => {
        if (cancelled) return;
        setScenarios(res.items || []);
      })
      .catch(() => {
        if (cancelled) return;
        setScenarios([]);
      })
      .finally(() => {
        if (!cancelled) setScenariosLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [analyticsRole, companyId]);

  useEffect(() => {
    if (!companyId) return;
    if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      const seq = ++requestSeq.current;
      setLoading(true);
      void simulateWhatIf({
        companyId,
        role: analyticsRole,
        horizonDays,
        drilldownBy,
        levers,
      })
        .then((res) => {
          if (seq !== requestSeq.current) return;
          setResult(res);
        })
        .catch(() => {
          if (seq !== requestSeq.current) return;
          onNotify("Не удалось пересчитать сценарий", "error");
        })
        .finally(() => {
          if (seq === requestSeq.current) setLoading(false);
        });
    }, 220);
    return () => {
      if (debounceRef.current != null) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [analyticsRole, companyId, drilldownBy, horizonDays, levers, onNotify]);

  const onLeverChange = (key: LeverKey, value: number) => {
    setLevers((prev) => ({ ...prev, [key]: value }));
  };

  const onSaveScenario = async () => {
    if (!companyId || !result) return;
    try {
      const created = await createWhatIfScenario({
        companyId,
        role: analyticsRole,
        title: `${analyticsRole === "buyer" ? "Buyer" : "Supplier"} • ${new Date().toLocaleDateString("ru-RU")}`,
        horizonDays,
        levers,
        result,
      });
      setScenarios((prev) => [created, ...prev].slice(0, 30));
      onNotify("Сценарий сохранен", "success");
    } catch {
      onNotify("Не удалось сохранить сценарий", "error");
    }
  };

  const onApplyScenario = (scenario: WhatIfScenario) => {
    setHorizonDays((scenario.horizon_days === 60 || scenario.horizon_days === 90 ? scenario.horizon_days : 30) as 30 | 60 | 90);
    setLevers((prev) => ({ ...prev, ...(scenario.levers || {}) }));
    if (scenario.result?.drilldown?.by === "sku") setDrilldownBy("sku");
    if (scenario.result?.drilldown?.by === "category") setDrilldownBy("category");
    if (scenario.result) setResult(scenario.result);
  };

  const onRenameScenario = async (scenario: WhatIfScenario) => {
    const next = window.prompt("Новое название сценария", scenario.title);
    if (!next || !next.trim()) return;
    try {
      await renameWhatIfScenario(scenario.id, next.trim());
      setScenarios((prev) => prev.map((x) => (x.id === scenario.id ? { ...x, title: next.trim() } : x)));
      onNotify("Название обновлено", "success");
    } catch {
      onNotify("Не удалось переименовать сценарий", "error");
    }
  };

  const onDeleteScenario = async (scenario: WhatIfScenario) => {
    if (!window.confirm(`Удалить сценарий «${scenario.title}»?`)) return;
    try {
      await deleteWhatIfScenario(scenario.id);
      setScenarios((prev) => prev.filter((x) => x.id !== scenario.id));
      onNotify("Сценарий удален", "success");
    } catch {
      onNotify("Не удалось удалить сценарий", "error");
    }
  };

  const onDiscuss = () => {
    if (!result || !onDiscussScenario) return;
    const msg = [
      `Разбери мой what-if сценарий (${result.horizon_days} дней).`,
      `Выручка: ${formatMoney(result.baseline.revenue_forecast_som)} -> ${formatMoney(result.scenario.revenue_forecast_som)}.`,
      `Delivery: ${formatPct(result.baseline.delivery_rate_pct)} -> ${formatPct(result.scenario.delivery_rate_pct)}.`,
      `Отмены: ${formatPct(result.baseline.cancel_rate_pct)} -> ${formatPct(result.scenario.cancel_rate_pct)}.`,
      `Драйверы: ${(result.drivers || []).slice(0, 3).join("; ")}.`,
      "Скажи, какие 2 шага приоритетнее всего и какие риски у этого сценария.",
    ].join(" ");
    onDiscussScenario(msg);
  };

  const compareMax = useMemo(() => {
    if (!result?.compare_series?.length) return 1;
    return Math.max(...result.compare_series.flatMap((x) => [x.baseline, x.scenario]), 1);
  }, [result]);

  const drilldownMax = useMemo(() => {
    if (!result?.drilldown?.points?.length) return 1;
    return Math.max(...result.drilldown.points.flatMap((x) => [x.baseline, x.scenario]), 1);
  }, [result]);

  return (
    <section className="ai-whatif">
      <div className="ai-whatif-head">
        <div>
          <h3>What-if Studio</h3>
          <p>Прокрутите ползунки и сразу увидите, как это влияет на деньги, доставки и отмены.</p>
        </div>
        <div className="ai-whatif-actions">
          <button type="button" onClick={onSaveScenario} disabled={!companyId || !result || loading}>
            Сохранить
          </button>
          <button type="button" onClick={onDiscuss} disabled={!result || !onDiscussScenario}>
            Обсудить в чате
          </button>
        </div>
      </div>

      <div className="ai-whatif-guide">
        <div>
          <strong>1.</strong>
          <span>Выберите период прогноза</span>
        </div>
        <div>
          <strong>2.</strong>
          <span>Подвиньте рычаги изменений</span>
        </div>
        <div>
          <strong>3.</strong>
          <span>Смотрите результат и риски ниже</span>
        </div>
      </div>

      <div className="ai-whatif-hero">
        <div className="ai-whatif-hero-main">
          <span>Главный эффект сценария</span>
          {result ? (
            <strong className={revenueDelta >= 0 ? "up" : "down"}>
              {revenueDelta >= 0 ? "+" : ""}
              {formatMoney(revenueDelta)}
            </strong>
          ) : (
            <strong>Пока считаем базу</strong>
          )}
          <small>
            За {horizonDays} дней{result ? `, уверенность модели: ${confidencePct}%` : "."}
          </small>
        </div>
        <div className="ai-whatif-presets">
          <button type="button" onClick={() => applyPreset("soft")}>
            Консервативно
          </button>
          <button type="button" onClick={() => applyPreset("balanced")}>
            Баланс
          </button>
          <button type="button" onClick={() => applyPreset("boost")}>
            Агрессивно
          </button>
        </div>
      </div>

      <div className="ai-whatif-pills">
        <div className="ai-whatif-pill-group">
          <span>Период прогноза</span>
          {[30, 60, 90].map((n) => (
            <button
              key={n}
              type="button"
              className={horizonDays === n ? "active" : ""}
              onClick={() => setHorizonDays(n as 30 | 60 | 90)}
            >
              {n}д
            </button>
          ))}
        </div>
        <div className="ai-whatif-pill-group">
          <span>Детализация</span>
          {(["category", "sku"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={drilldownBy === mode ? "active" : ""}
              onClick={() => setDrilldownBy(mode)}
            >
              {mode === "category" ? "Категории" : "SKU"}
            </button>
          ))}
        </div>
      </div>

      <div className="ai-whatif-levers">
        {leverConfigs.map((lever) => (
          <label key={lever.key} className="ai-whatif-lever">
            <div className="ai-whatif-lever-top">
              <span>{lever.label}</span>
              <b>
                {levers[lever.key]}
                {lever.suffix}
              </b>
            </div>
            <small>{lever.hint}</small>
            <input
              type="range"
              min={lever.min}
              max={lever.max}
              step={lever.step}
              value={levers[lever.key]}
              onChange={(e) => onLeverChange(lever.key, Number(e.target.value))}
            />
          </label>
        ))}
      </div>

      <div className="ai-whatif-kpis">
        {loading && !result ? <div className="ai-whatif-skeleton">Считаем сценарий...</div> : null}
        {visibleMetricCards.map((card) => (
          <article key={card.key} className="ai-whatif-kpi">
            <div className="ai-whatif-kpi-title">{card.title}</div>
            <div className="ai-whatif-kpi-hint">{card.hint}</div>
            <div className="ai-whatif-kpi-main">
              <div>
                <span>База</span>
                <strong>{card.baseline}</strong>
              </div>
              <div>
                <span>Сценарий</span>
                <strong>{card.scenario}</strong>
              </div>
            </div>
            <div className={`ai-whatif-kpi-delta ${normalizeDeltaTone(card.delta, card.improveWhen)}`}>{card.deltaLabel}</div>
          </article>
        ))}
      </div>

      <div className="ai-whatif-charts">
        <article className="ai-whatif-chart">
          <h4>До/после по периоду</h4>
          <div className="ai-whatif-bars">
            {(result?.compare_series || []).map((row) => (
              <div key={row.period} className="ai-whatif-bar-row">
                <div className="ai-whatif-bar-label">{row.period}</div>
                <div className="ai-whatif-bar-track">
                  <span className="base" style={{ width: `${(row.baseline / compareMax) * 100}%` }} />
                  <span className="scenario" style={{ width: `${(row.scenario / compareMax) * 100}%` }} />
                </div>
                <div className="ai-whatif-bar-values">
                  <small>{formatMoney(row.baseline)}</small>
                  <small>{formatMoney(row.scenario)}</small>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="ai-whatif-chart">
          <h4>{result?.drilldown?.by === "sku" ? "Drilldown по SKU" : "Drilldown по категориям"}</h4>
          <div className="ai-whatif-bars">
            {(result?.drilldown?.points || []).map((row) => (
              <div key={row.key} className="ai-whatif-bar-row">
                <div className="ai-whatif-bar-label">{row.key}</div>
                <div className="ai-whatif-bar-track">
                  <span className="base" style={{ width: `${(row.baseline / drilldownMax) * 100}%` }} />
                  <span className="scenario" style={{ width: `${(row.scenario / drilldownMax) * 100}%` }} />
                </div>
                <div className={`ai-whatif-drill-delta ${deltaClass(row.delta_pct)}`}>
                  {row.delta_pct >= 0 ? "+" : ""}
                  {row.delta_pct.toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>

      {result ? (
        <div className="ai-whatif-insights">
          <div className="ai-whatif-insights-block">
            <h4>Ключевые драйверы</h4>
            <ul>
              {(result.drivers || []).slice(0, 3).map((line, idx) => (
                <li key={`driver-${idx}`}>{line}</li>
              ))}
            </ul>
          </div>
          <div className="ai-whatif-insights-block">
            <h4>Ограничения</h4>
            <ul>
              {(result.warnings || []).length ? (
                result.warnings.map((line, idx) => <li key={`warn-${idx}`}>{line}</li>)
              ) : (
                <li>Критичных ограничений не обнаружено.</li>
              )}
            </ul>
            <div className="ai-whatif-confidence">Уверенность модели: {confidencePct}%</div>
          </div>
        </div>
      ) : null}

      <div className="ai-whatif-scenarios">
        <div className="ai-whatif-scenarios-head">
          <h4>Сохраненные сценарии</h4>
          <span>{scenariosLoading ? "Загрузка..." : `${scenarios.length} шт`}</span>
        </div>
        <div className="ai-whatif-scenario-list">
          {scenarios.map((scenario) => (
            <div key={scenario.id} className="ai-whatif-scenario-item">
              <button type="button" className="ai-whatif-scenario-main" onClick={() => onApplyScenario(scenario)}>
                <div className="ai-whatif-scenario-title">{scenario.title}</div>
                <div className="ai-whatif-scenario-meta">
                  {scenario.horizon_days}д • {new Date(scenario.updated_at).toLocaleString("ru-RU")}
                </div>
              </button>
              <div className="ai-whatif-scenario-actions">
                <button type="button" onClick={() => void onRenameScenario(scenario)}>
                  ✎
                </button>
                <button type="button" onClick={() => void onDeleteScenario(scenario)}>
                  🗑
                </button>
              </div>
            </div>
          ))}
          {!scenarios.length && !scenariosLoading ? <div className="ai-whatif-scenario-empty">Пока нет сохраненных сценариев.</div> : null}
        </div>
      </div>
    </section>
  );
}
