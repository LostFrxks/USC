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
type Role = "buyer" | "supplier";
type LeverKey = keyof Required<WhatIfLevers>;
type LeverConfig = { key: LeverKey; label: string; hint: string; min: number; max: number; step: number; suffix: string };

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
  { key: "delivery_improve_pp", label: "Delivery boost", hint: "Стабилизировать доведение заказов до delivered.", min: 0, max: 20, step: 1, suffix: "п.п." },
  { key: "cancel_reduce_pp", label: "Cancel cut", hint: "Убрать потери на отменах и сбоях.", min: 0, max: 15, step: 0.5, suffix: "п.п." },
  { key: "top_category_share_reduce_pp", label: "Category rebalance", hint: "Снизить зависимость от одной категории.", min: 0, max: 25, step: 1, suffix: "п.п." },
  { key: "promo_intensity_pct", label: "Demand pulse", hint: "Подогреть спрос через промо.", min: 0, max: 20, step: 1, suffix: "%" },
];
const BUYER_LEVERS: LeverConfig[] = [
  { key: "cheaper_supplier_shift_pct", label: "Price shift", hint: "Перевести объем к более дешевому поставщику.", min: 0, max: 100, step: 5, suffix: "%" },
  { key: "reliable_supplier_shift_pct", label: "Reliability shift", hint: "Перевести объем к более надежному поставщику.", min: 0, max: 100, step: 5, suffix: "%" },
];
const SUPPLIER_LEVERS: LeverConfig[] = [
  { key: "price_cut_overpriced_pct", label: "Price correction", hint: "Снизить цену у переоцененных SKU.", min: 0, max: 20, step: 1, suffix: "%" },
  { key: "pipeline_recovery_pct", label: "Pipeline recovery", hint: "Быстрее закрыть заказы из pipeline.", min: 0, max: 60, step: 5, suffix: "%" },
];

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const roleOf = (role?: string | null): Role => ((role || "").toLowerCase() === "supplier" ? "supplier" : "buyer");
const money = (v: number) => `${Math.round(Number.isFinite(v) ? v : 0).toLocaleString("ru-RU")} сом`;
const compact = (v: number) => {
  const n = Number.isFinite(v) ? v : 0;
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M сом`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}k сом`;
  return `${Math.round(n)} сом`;
};
const pct = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? "—" : `${(Math.round(v * 10) / 10).toFixed(1)}%`);
const signed = (v: number, suffix = "") => `${v > 0 ? "+" : ""}${v.toFixed(1)}${suffix}`;
const tone = (v: number) => (v > 0 ? "up" : v < 0 ? "down" : "neutral");
const goodTone = (v: number, improveWhen: "up" | "down") => (v === 0 ? "neutral" : improveWhen === "up" ? (v > 0 ? "up" : "down") : v < 0 ? "up" : "down");

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
  const analyticsRole = roleOf(role);
  const [horizonDays, setHorizonDays] = useState<30 | 60 | 90>(30);
  const [drilldownBy, setDrilldownBy] = useState<"category" | "sku">("category");
  const [levers, setLevers] = useState<Required<WhatIfLevers>>(DEFAULT_LEVERS);
  const [result, setResult] = useState<WhatIfResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [scenariosLoading, setScenariosLoading] = useState(false);
  const [scenarios, setScenarios] = useState<WhatIfScenario[]>([]);
  const [renameTarget, setRenameTarget] = useState<WhatIfScenario | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<WhatIfScenario | null>(null);
  const requestSeq = useRef(0);
  const debounceRef = useRef<number | null>(null);

  const leverConfigs = useMemo(() => (analyticsRole === "buyer" ? [...COMMON_LEVERS, ...BUYER_LEVERS] : [...COMMON_LEVERS, ...SUPPLIER_LEVERS]), [analyticsRole]);
  const compareMax = useMemo(() => Math.max(...(result?.compare_series || []).flatMap((x) => [x.baseline, x.scenario]), 1), [result]);
  const drilldown = useMemo(() => [...(result?.drilldown?.points || [])].sort((a, b) => Math.abs(b.delta_pct) - Math.abs(a.delta_pct)).slice(0, 5), [result]);

  const revenueDelta = Number(result?.delta.revenue_forecast_som || 0);
  const deliveryDelta = Number(result?.delta.delivery_rate_pct || 0);
  const cancelDelta = Number(result?.delta.cancel_rate_pct || 0);
  const leakDelta = Number(result?.delta.leakage_value_som || 0);
  const retainedBase = (result?.baseline.revenue_forecast_som || 0) - (result?.baseline.leakage_value_som || 0) + (result?.baseline.savings_potential_som || 0);
  const retainedScenario = (result?.scenario.revenue_forecast_som || 0) - (result?.scenario.leakage_value_som || 0) + (result?.scenario.savings_potential_som || 0);
  const retainedDelta = retainedScenario - retainedBase;
  const confidencePct = Math.round((result?.confidence || 0) * 100);
  const activeLevers = useMemo(
    () =>
      leverConfigs
        .filter((lever) => Number(levers[lever.key]) > 0)
        .sort((a, b) => Number(levers[b.key]) - Number(levers[a.key]))
        .map((lever) => ({
          key: lever.key,
          label: lever.label,
          value: `${levers[lever.key]}${lever.suffix}`,
        })),
    [leverConfigs, levers],
  );
  const scenarioActs = useMemo(() => {
    if (!result?.compare_series?.length) return [];
    return result.compare_series.map((point, index, series) => {
      const prev = index === 0 ? point.baseline : series[index - 1].scenario;
      const delta = point.scenario - prev;
      const intensity = clamp((Math.abs(delta) / Math.max(point.scenario, point.baseline, 1)) * 320, 12, 100);
      let title = "Stability window";
      if (delta >= 0) title = index === 0 ? "Demand ignition" : index === series.length - 1 ? "Profit capture" : "Growth release";
      if (delta < 0) title = Math.abs(delta) > Math.max(point.scenario, 1) * 0.14 ? "Stress spike" : "Friction pocket";
      return { period: point.period, delta, intensity, title };
    });
  }, [result]);

  const headline = useMemo(() => {
    if (!result) return { title: "Собираем сцену сценария", text: "Подвигайте рычаги и система покажет, где рождается рост, а где появляется перегрев." };
    if (revenueDelta > 0 && deliveryDelta >= 0 && cancelDelta <= 0) return { title: `Сцена открывает ${compact(revenueDelta)} upside без потери контроля`, text: "Рост не съедается исполнением: delivery поддерживает сценарий, а cancel pressure не усиливается." };
    if (revenueDelta > 0) return { title: "Рост появляется, но сцена подсвечивает перегрузку", text: "Деньги приходят, но часть эффекта утекает в cancel, leakage или перегретую операционку." };
    return { title: "Сценарий требует перенастройки", text: "Текущая комбинация не создает достаточно сильного upside и не снимает главный риск." };
  }, [cancelDelta, deliveryDelta, result, revenueDelta]);

  const applyPreset = (mode: "soft" | "balanced" | "boost") => {
    const base = { ...DEFAULT_LEVERS };
    if (mode === "soft") Object.assign(base, analyticsRole === "buyer" ? { delivery_improve_pp: 2, cancel_reduce_pp: 1, top_category_share_reduce_pp: 2, promo_intensity_pct: 3, cheaper_supplier_shift_pct: 10, reliable_supplier_shift_pct: 10 } : { delivery_improve_pp: 2, cancel_reduce_pp: 1, top_category_share_reduce_pp: 2, promo_intensity_pct: 3, price_cut_overpriced_pct: 3, pipeline_recovery_pct: 10 });
    if (mode === "balanced") Object.assign(base, analyticsRole === "buyer" ? { delivery_improve_pp: 5, cancel_reduce_pp: 2, top_category_share_reduce_pp: 4, promo_intensity_pct: 7, cheaper_supplier_shift_pct: 20, reliable_supplier_shift_pct: 20 } : { delivery_improve_pp: 5, cancel_reduce_pp: 2, top_category_share_reduce_pp: 4, promo_intensity_pct: 7, price_cut_overpriced_pct: 6, pipeline_recovery_pct: 20 });
    if (mode === "boost") Object.assign(base, analyticsRole === "buyer" ? { delivery_improve_pp: 9, cancel_reduce_pp: 4, top_category_share_reduce_pp: 8, promo_intensity_pct: 12, cheaper_supplier_shift_pct: 35, reliable_supplier_shift_pct: 30 } : { delivery_improve_pp: 9, cancel_reduce_pp: 4, top_category_share_reduce_pp: 8, promo_intensity_pct: 12, price_cut_overpriced_pct: 10, pipeline_recovery_pct: 30 });
    setLevers(base);
  };

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    setScenariosLoading(true);
    void fetchWhatIfScenarios({ companyId, role: analyticsRole, limit: 30 }).then((res) => !cancelled && setScenarios(res.items || [])).catch(() => !cancelled && setScenarios([])).finally(() => !cancelled && setScenariosLoading(false));
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
      void simulateWhatIf({ companyId, role: analyticsRole, horizonDays, drilldownBy, levers })
        .then((res) => seq === requestSeq.current && setResult(res))
        .catch(() => seq === requestSeq.current && onNotify("Не удалось пересчитать сценарий", "error"))
        .finally(() => seq === requestSeq.current && setLoading(false));
    }, 220);
    return () => {
      if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
    };
  }, [analyticsRole, companyId, drilldownBy, horizonDays, levers, onNotify]);

  const onSaveScenario = async () => {
    if (!companyId || !result) return;
    try {
      const created = await createWhatIfScenario({ companyId, role: analyticsRole, title: `${analyticsRole === "buyer" ? "Buyer" : "Supplier"} Theater • ${new Date().toLocaleDateString("ru-RU")}`, horizonDays, levers, result });
      setScenarios((prev) => [created, ...prev].slice(0, 30));
      onNotify("Сцена сохранена", "success");
    } catch {
      onNotify("Не удалось сохранить сцену", "error");
    }
  };

  const onDiscuss = () => {
    if (!result || !onDiscussScenario) return;
    onDiscussScenario([`Разбери мой Scenario Theater на ${result.horizon_days} дней.`, `Выручка: ${money(result.baseline.revenue_forecast_som)} -> ${money(result.scenario.revenue_forecast_som)}.`, `Delivery: ${pct(result.baseline.delivery_rate_pct)} -> ${pct(result.scenario.delivery_rate_pct)}.`, `Cancel: ${pct(result.baseline.cancel_rate_pct)} -> ${pct(result.scenario.cancel_rate_pct)}.`, `Leakage: ${money(result.baseline.leakage_value_som)} -> ${money(result.scenario.leakage_value_som)}.`, "Скажи, где bottleneck, где настоящий upside и какие 2 действия делать первыми."].join(" "));
  };

  const onRenameScenario = async () => {
    if (!renameTarget || !renameDraft.trim()) return;
    try {
      await renameWhatIfScenario(renameTarget.id, renameDraft.trim());
      setScenarios((prev) => prev.map((item) => (item.id === renameTarget.id ? { ...item, title: renameDraft.trim() } : item)));
      setRenameTarget(null);
      setRenameDraft("");
      onNotify("Название обновлено", "success");
    } catch {
      onNotify("Не удалось переименовать сценарий", "error");
    }
  };

  const onDeleteScenario = async () => {
    if (!deleteTarget) return;
    try {
      await deleteWhatIfScenario(deleteTarget.id);
      setScenarios((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
      onNotify("Сцена удалена", "success");
    } catch {
      onNotify("Не удалось удалить сцену", "error");
    }
  };

  const pressureCards = [
    { label: "Demand heat", value: result ? clamp(48 + (revenueDelta / Math.max(result.baseline.revenue_forecast_som, 1)) * 240 + levers.promo_intensity_pct * 1.3, 0, 100) : 0, text: result ? "Сколько импульса в спросе." : "Нет расчета", theme: "blue" },
    { label: "Ops pressure", value: result ? clamp(100 - result.scenario.delivery_rate_pct + result.scenario.cancel_rate_pct * 2.2 + result.scenario.leakage_score * 0.45, 0, 100) : 0, text: result ? "Где сцена начинает упираться в исполнение." : "Нет расчета", theme: "amber" },
    { label: "Margin shield", value: result ? clamp(72 + (result.scenario.savings_potential_som / Math.max(result.scenario.revenue_forecast_som, 1)) * 280 - (result.scenario.leakage_value_som / Math.max(result.scenario.revenue_forecast_som, 1)) * 160, 0, 100) : 0, text: result ? "Насколько сцене удается удержать ценность." : "Нет расчета", theme: "green" },
    { label: "Risk load", value: result ? analyticsRole === "buyer" ? clamp(result.scenario.supplier_hhi * 110 + result.scenario.category_hhi * 90, 0, 100) : clamp((100 - result.scenario.repeat_rate_pct) * 0.75 + result.scenario.leakage_score * 0.55, 0, 100) : 0, text: result ? "Концентрация, утечки и слабые места." : "Нет расчета", theme: "red" },
  ];

  const theaterNodes = [
    { eyebrow: "Demand Pulse", title: analyticsRole === "buyer" ? "Спрос на закупку" : "Потенциал продаж", base: result ? compact(result.baseline.revenue_forecast_som) : "—", live: result ? compact(result.scenario.revenue_forecast_som) : "—", delta: result ? `${revenueDelta >= 0 ? "+" : ""}${compact(revenueDelta)}` : "Ожидаем симуляцию", note: result ? `Доля на платформе ${pct(result.baseline.market_share_pct)} -> ${pct(result.scenario.market_share_pct)}.` : "Покажем, как сцена двигает выручку.", kind: "demand", tone: tone(revenueDelta) },
    { eyebrow: "Fulfillment", title: "Исполнение", base: result ? pct(result.baseline.delivery_rate_pct) : "—", live: result ? pct(result.scenario.delivery_rate_pct) : "—", delta: result ? `${signed(deliveryDelta, " п.п.")}` : "Ожидаем симуляцию", note: result ? `Delivery pressure ${deliveryDelta >= 0 ? "снимается" : "растет"} вместе со сценой.` : "Покажем, выдержит ли система рост.", kind: "ops", tone: goodTone(deliveryDelta, "up") },
    { eyebrow: "Leakage", title: analyticsRole === "buyer" ? "Потери и отмены" : "Операционные утечки", base: result ? compact(result.baseline.leakage_value_som) : "—", live: result ? compact(result.scenario.leakage_value_som) : "—", delta: result ? `${leakDelta >= 0 ? "+" : ""}${compact(leakDelta)}` : "Ожидаем симуляцию", note: result ? `Cancel ${pct(result.baseline.cancel_rate_pct)} -> ${pct(result.scenario.cancel_rate_pct)}.` : "Покажем, куда утекает ценность.", kind: "risk", tone: goodTone(leakDelta, "down") },
    { eyebrow: "Value Capture", title: analyticsRole === "buyer" ? "Захваченная выгода" : "Удержанная ценность", base: result ? compact(retainedBase) : "—", live: result ? compact(retainedScenario) : "—", delta: result ? `${retainedDelta >= 0 ? "+" : ""}${compact(retainedDelta)}` : "Ожидаем симуляцию", note: result ? analyticsRole === "buyer" ? `Savings potential: ${compact(result.scenario.savings_potential_som)}.` : `Repeat rate: ${pct(result.scenario.repeat_rate_pct)}.` : "Финальный слой покажет реальную ценность.", kind: "value", tone: tone(retainedDelta) },
  ];

  const flowCards = result
    ? [
        { label: analyticsRole === "buyer" ? "Budget in motion" : "Demand entering", value: result.scenario.revenue_forecast_som, base: result.baseline.revenue_forecast_som, note: "Общий объем сценария.", theme: "blue" },
        { label: "Value delivered", value: result.scenario.revenue_forecast_som * (result.scenario.delivery_rate_pct / 100), base: result.baseline.revenue_forecast_som * (result.baseline.delivery_rate_pct / 100), note: "Что реально доходит до исполнения.", theme: "green" },
        { label: "Leakage", value: result.scenario.leakage_value_som, base: result.baseline.leakage_value_som, note: "Часть сцены, которая теряется.", theme: "red" },
        { label: analyticsRole === "buyer" ? "Protected value" : "Retained value", value: retainedScenario, base: retainedBase, note: "Финальный захват ценности.", theme: "gold" },
      ]
    : [];
  const flowMax = Math.max(...flowCards.flatMap((x) => [x.value, x.base]), 1);

  const decisions = result
    ? [
        { kicker: "Primary move", title: revenueDelta >= 0 ? `Здесь можно открыть ${compact(revenueDelta)} upside` : "Сцена пока не создает роста", text: revenueDelta >= 0 ? "Но только если зафиксировать bottleneck в исполнении и не дать утечкам съесть upside." : "Сначала пересоберите рычаги вокруг delivery, cancel и risk load.", tone: tone(revenueDelta) },
        { kicker: "Bottleneck", title: deliveryDelta >= 0 && cancelDelta <= 0 ? "Исполнение поддерживает сцену" : "Узкое место остается в операционке", text: deliveryDelta >= 0 && cancelDelta <= 0 ? "Это хороший признак: рост не конфликтует с логистикой." : `Delivery ${signed(deliveryDelta, " п.п.")}, cancel ${signed(cancelDelta, " п.п.")}. Значит, рост может быть съеден исполнением.`, tone: deliveryDelta >= 0 && cancelDelta <= 0 ? "up" : "down" },
        { kicker: "Shockwave", title: drilldown[0] ? `${drilldown[0].key} меняется сильнее остальных` : "Shockwave появится после расчета", text: drilldown[0] ? `Это направление двигается на ${drilldown[0].delta_pct >= 0 ? "+" : ""}${drilldown[0].delta_pct.toFixed(1)}% и задает характер всей сцены.` : "Здесь будут самые сильные сдвиги по SKU или категориям.", tone: drilldown[0] ? tone(drilldown[0].delta_pct) : "neutral" },
        { kicker: "Risk note", title: result.warnings[0] ? "Сценарий требует страховки" : "Критичных блокеров пока не видно", text: result.warnings[0] || "Модель не подсветила жестких ограничений. Такой сценарий можно использовать как базовый кандидат.", tone: result.warnings[0] ? "down" : "up" },
      ]
    : [];

  return (
    <section className="ai-whatif ai-whatif-theater">
      <div className="ai-whatif-head">
        <div>
          <h3>Scenario Theater</h3>
          <p>Живая сцена причин и последствий. Не просто метрики, а ответ на вопрос, где рождается ценность и где она ломается.</p>
        </div>
        <div className="ai-whatif-actions">
          <button type="button" onClick={onSaveScenario} disabled={!companyId || !result || loading}>Сохранить сцену</button>
          <button type="button" onClick={onDiscuss} disabled={!result || !onDiscussScenario}>Обсудить в AI</button>
        </div>
      </div>

      <div className="ai-whatif-stage-hero">
        <div className="ai-whatif-stage-copy">
          <div className="ai-whatif-stage-kicker">Scenario signal</div>
          <h4>{headline.title}</h4>
          <p>{headline.text}</p>
          <div className="ai-whatif-stage-meta"><span>{`${horizonDays} дней`}</span><span>{result ? `Confidence ${confidencePct}%` : "Ожидаем симуляцию"}</span><span>{analyticsRole === "buyer" ? "Buyer mode" : "Supplier mode"}</span></div>
        </div>
        <div className="ai-whatif-stage-impact">
          <div className="ai-whatif-stage-orb" aria-hidden="true"><span /><span /><span /></div>
          <div className="ai-whatif-stage-impact-label">Modeled upside</div>
          <div className={`ai-whatif-stage-impact-value ${revenueDelta >= 0 ? "up" : "down"}`}>{revenueDelta >= 0 ? "+" : ""}{compact(revenueDelta)}</div>
          <div className="ai-whatif-stage-impact-note">{result ? `${compact(result.baseline.revenue_forecast_som)} -> ${compact(result.scenario.revenue_forecast_som)}` : "Подвигайте рычаги и дождитесь расчета"}</div>
        </div>
      </div>

      <div className="ai-whatif-dna-strip">
        <div className="ai-whatif-panel-title">Scenario DNA</div>
        <div className="ai-whatif-dna-list">
          {activeLevers.length
            ? activeLevers.map((lever) => <span key={lever.key} className="ai-whatif-dna-pill">{lever.label}<b>{lever.value}</b></span>)
            : <span className="ai-whatif-dna-empty">Пока нет активных рычагов. Соберите комбинацию влияний, чтобы увидеть характер сцены.</span>}
        </div>
      </div>

      <div className="ai-whatif-switchboard">
        <div className="ai-whatif-pill-group"><span>Период</span>{[30, 60, 90].map((days) => <button key={days} type="button" className={horizonDays === days ? "active" : ""} onClick={() => setHorizonDays(days as 30 | 60 | 90)}>{days}д</button>)}</div>
        <div className="ai-whatif-pill-group"><span>Детализация</span>{(["category", "sku"] as const).map((mode) => <button key={mode} type="button" className={drilldownBy === mode ? "active" : ""} onClick={() => setDrilldownBy(mode)}>{mode === "category" ? "Категории" : "SKU"}</button>)}</div>
        <div className="ai-whatif-presets"><button type="button" onClick={() => applyPreset("soft")}>Soft pulse</button><button type="button" onClick={() => applyPreset("balanced")}>Balanced play</button><button type="button" onClick={() => applyPreset("boost")}>Max push</button></div>
      </div>

      <div className="ai-whatif-control-grid">
        <div className="ai-whatif-control-panel">
          <div className="ai-whatif-panel-title">Scenario levers</div>
          <div className="ai-whatif-panel-subtitle">Каждый рычаг меняет сцену. Важен не только рост, но и то, где система треснет первой.</div>
          <div className="ai-whatif-levers">{leverConfigs.map((lever) => <label key={lever.key} className="ai-whatif-lever"><div className="ai-whatif-lever-top"><span>{lever.label}</span><b>{levers[lever.key]}{lever.suffix}</b></div><small>{lever.hint}</small><input type="range" min={lever.min} max={lever.max} step={lever.step} value={levers[lever.key]} onChange={(e) => setLevers((prev) => ({ ...prev, [lever.key]: Number(e.target.value) }))} /></label>)}</div>
        </div>
        <div className="ai-whatif-pressure-board">
          <div className="ai-whatif-panel-title">Pressure board</div>
          <div className="ai-whatif-panel-subtitle">Спрос, операционка, маржа и риск в одном поле. Это быстрый слой принятия решения.</div>
          <div className="ai-whatif-pressure-grid">{pressureCards.map((card) => <article key={card.label} className={`ai-whatif-pressure-card ${card.theme}`}><div className="ai-whatif-pressure-top"><span>{card.label}</span><strong>{Math.round(card.value)}</strong></div><div className="ai-whatif-pressure-meter"><span style={{ width: `${card.value}%` }} /></div><p>{card.text}</p></article>)}</div>
        </div>
      </div>

      <div className="ai-whatif-scene">
        <div className="ai-whatif-scene-head"><div><div className="ai-whatif-panel-title">Impact cascade</div><div className="ai-whatif-panel-subtitle">Один импульс проходит через спрос, исполнение, утечки и финальную ценность.</div></div>{loading ? <div className="ai-whatif-scene-loading">Пересчитываем сцену...</div> : null}</div>
        <div className="ai-whatif-cascade">{theaterNodes.map((node, index) => <article key={node.title} className={`ai-whatif-node ${node.kind}`}><div className="ai-whatif-node-eyebrow">{node.eyebrow}</div><div className="ai-whatif-node-title">{node.title}</div><div className="ai-whatif-node-values"><div><span>База</span><strong>{node.base}</strong></div><div><span>Сцена</span><strong>{node.live}</strong></div></div><div className={`ai-whatif-node-delta ${node.tone}`}>{node.delta}</div><p>{node.note}</p>{index < theaterNodes.length - 1 ? <div className="ai-whatif-node-connector" aria-hidden="true" /> : null}</article>)}</div>
      </div>

      {flowCards.length ? <div className="ai-whatif-moneyflow"><div className="ai-whatif-moneyflow-copy"><div className="ai-whatif-panel-title">Money flow infographic</div><div className="ai-whatif-panel-subtitle">Не просто KPI, а маршрут ценности: где деньги входят, где теряются и сколько реально удерживается.</div></div><div className="ai-whatif-money-columns">{flowCards.map((card) => <article key={card.label} className={`ai-whatif-money-card ${card.theme}`}><div className="ai-whatif-money-visual"><span className="ai-whatif-money-base" style={{ height: `${(card.base / flowMax) * 100}%` }} /><span className="ai-whatif-money-live" style={{ height: `${(card.value / flowMax) * 100}%` }} /></div><div className="ai-whatif-money-label">{card.label}</div><div className="ai-whatif-money-value">{compact(card.value)}</div><div className="ai-whatif-money-note">{card.note}</div></article>)}</div></div> : null}

      <div className="ai-whatif-reality-wall">
        <article className="ai-whatif-chart ai-whatif-chart-wide"><h4>Timeline before / after</h4><div className="ai-whatif-bars">{(result?.compare_series || []).map((row) => <div key={row.period} className="ai-whatif-bar-row"><div className="ai-whatif-bar-label">{row.period}</div><div className="ai-whatif-bar-track"><span className="base" style={{ width: `${(row.baseline / compareMax) * 100}%` }} /><span className="scenario" style={{ width: `${(row.scenario / compareMax) * 100}%` }} /></div><div className="ai-whatif-bar-values"><small>{compact(row.baseline)}</small><small>{compact(row.scenario)}</small></div></div>)}{!result?.compare_series?.length ? <div className="ai-whatif-skeleton">Пока строим временную сцену.</div> : null}</div></article>
        <article className="ai-whatif-chart"><h4>{result?.drilldown?.by === "sku" ? "Shockwave by SKU" : "Shockwave by category"}</h4><div className="ai-whatif-shock-list">{drilldown.map((row) => <div key={row.key} className="ai-whatif-shock-item"><div className="ai-whatif-shock-top"><strong>{row.key}</strong><span className={tone(row.delta_pct)}>{row.delta_pct >= 0 ? "+" : ""}{row.delta_pct.toFixed(1)}%</span></div><div className="ai-whatif-shock-meter"><span style={{ width: `${clamp(Math.abs(row.delta_pct) * 3.2, 6, 100)}%` }} /></div><small>{`${compact(row.baseline)} -> ${compact(row.scenario)}`}</small></div>)}{!drilldown.length ? <div className="ai-whatif-skeleton">Shockwave появится после расчета.</div> : null}</div></article>
      </div>

      <div className="ai-whatif-acts">
        <div className="ai-whatif-panel-title">Scenario acts</div>
        <div className="ai-whatif-panel-subtitle">Сценарий теперь читается как история: где появляется импульс, где нарастает трение и когда сцена начинает забирать ценность.</div>
        <div className="ai-whatif-acts-grid">
          {scenarioActs.length
            ? scenarioActs.map((act) => <article key={act.period} className="ai-whatif-act-card"><div className="ai-whatif-act-top"><span className="ai-whatif-act-period">{act.period}</span><span className={`ai-whatif-act-delta ${tone(act.delta)}`}>{act.delta >= 0 ? "+" : ""}{compact(act.delta)}</span></div><h4 className="ai-whatif-act-title">{act.title}</h4><div className="ai-whatif-act-meter"><span style={{ width: `${act.intensity}%` }} /></div></article>)
            : <div className="ai-whatif-skeleton">Акты сценария появятся после расчета.</div>}
        </div>
      </div>

      <div className="ai-whatif-decision-grid">{decisions.map((card) => <article key={card.kicker} className={`ai-whatif-decision-card ${card.tone}`}><div className="ai-whatif-decision-kicker">{card.kicker}</div><h4>{card.title}</h4><p>{card.text}</p></article>)}</div>

      <div className="ai-whatif-insights">
        <div className="ai-whatif-insights-block"><h4>Drivers</h4><ul>{(result?.drivers || []).length ? result?.drivers.slice(0, 4).map((line, idx) => <li key={`driver-${idx}`}>{line}</li>) : <li>Драйверы появятся после первой симуляции.</li>}</ul></div>
        <div className="ai-whatif-insights-block"><h4>Warnings</h4><ul>{(result?.warnings || []).length ? result?.warnings.slice(0, 4).map((line, idx) => <li key={`warning-${idx}`}>{line}</li>) : <li>Критичных ограничений пока не видно.</li>}</ul><div className="ai-whatif-confidence">Уверенность модели: {result ? `${confidencePct}%` : "—"}</div></div>
      </div>

      <div className="ai-whatif-scenarios">
        <div className="ai-whatif-scenarios-head"><h4>Saved scenes</h4><span>{scenariosLoading ? "Загрузка..." : `${scenarios.length} шт`}</span></div>
        <div className="ai-whatif-scenario-list">{scenarios.map((scenario) => <div key={scenario.id} className="ai-whatif-scenario-item"><button type="button" className="ai-whatif-scenario-main" onClick={() => { setHorizonDays((scenario.horizon_days === 60 || scenario.horizon_days === 90 ? scenario.horizon_days : 30) as 30 | 60 | 90); setLevers((prev) => ({ ...prev, ...(scenario.levers || {}) })); if (scenario.result?.drilldown?.by) setDrilldownBy(scenario.result.drilldown.by); if (scenario.result) setResult(scenario.result); }}><div className="ai-whatif-scenario-title">{scenario.title}</div><div className="ai-whatif-scenario-meta">{scenario.horizon_days}д • {new Date(scenario.updated_at).toLocaleString("ru-RU")}</div></button><div className="ai-whatif-scenario-actions"><button type="button" onClick={() => { setRenameTarget(scenario); setRenameDraft(scenario.title); }}>✎</button><button type="button" onClick={() => setDeleteTarget(scenario)}>×</button></div></div>)}{!scenarios.length && !scenariosLoading ? <div className="ai-whatif-scenario-empty">Пока нет сохраненных сцен.</div> : null}</div>
      </div>

      {renameTarget ? <div className="modal-backdrop" role="presentation"><div className="modal-card ai-whatif-dialog" role="dialog" aria-modal="true" aria-labelledby="whatif-rename-title"><div className="modal-head"><div className="modal-title" id="whatif-rename-title">Переименовать сцену</div><button className="modal-x" type="button" onClick={() => { setRenameTarget(null); setRenameDraft(""); }} aria-label="Закрыть">×</button></div><div className="modal-body"><label className="ai-whatif-dialog-label" htmlFor="whatif-rename-input">Название</label><input id="whatif-rename-input" className="ai-whatif-dialog-input" value={renameDraft} onChange={(e) => setRenameDraft(e.target.value)} maxLength={120} autoFocus /><div className="modal-actions"><button className="secondary-button" type="button" onClick={() => { setRenameTarget(null); setRenameDraft(""); }}>Отмена</button><button className="modal-primary" type="button" onClick={() => void onRenameScenario()} disabled={!renameDraft.trim()}>Сохранить</button></div></div></div></div> : null}
      {deleteTarget ? <div className="modal-backdrop" role="presentation"><div className="modal-card ai-whatif-dialog" role="dialog" aria-modal="true" aria-labelledby="whatif-delete-title"><div className="modal-head"><div className="modal-title" id="whatif-delete-title">Удалить сцену</div><button className="modal-x" type="button" onClick={() => setDeleteTarget(null)} aria-label="Закрыть">×</button></div><div className="modal-body"><p className="ai-whatif-dialog-text">Сцена <b>{deleteTarget.title}</b> будет удалена без возможности восстановления.</p><div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setDeleteTarget(null)}>Отмена</button><button className="modal-primary ai-whatif-danger" type="button" onClick={() => void onDeleteScenario()}>Удалить</button></div></div></div></div> : null}
    </section>
  );
}
