# AI What-if Simulator: Detailed Product Spec (MVP+)

Дата: 2026-03-03
Статус: Draft for approval

## 1. Product Definition

What-if Simulator в USC — это интерактивная "сценарная студия" на 30/60/90 дней, где пользователь двигает рычаги бизнеса и в реальном времени видит прогноз изменений KPI.

Ключевой принцип:
- ИИ ничего не применяет автоматически.
- ИИ только считает, объясняет и визуализирует последствия.

## 2. Core Scenario Theme

Симулятор отвечает на вопрос:
"Если я изменю X в закупках/доставке/ценах, что будет с выручкой, риском и качеством исполнения?"

Роли:
- Buyer: фокус на экономии, надежности поставщиков и концентрации рисков.
- Supplier: фокус на выручке, утечках, повторных клиентах и конкурентности цены.

## 3. Input Levers (What user can shift)

### 3.1 Common levers (оба режима)

| Lever | Range | Step | Effect direction |
|---|---:|---:|---|
| Горизонт прогноза | 30 / 60 / 90 дней | preset | масштаб эффекта |
| Целевой delivery rate | +0..+20 п.п. | 1 п.п. | влияет на pipeline->delivered |
| Целевой cancel rate | -0..-15 п.п. | 0.5 п.п. | снижает потери/утечки |
| Топ-категория диверсификация | -0..-25 п.п. доли | 1 п.п. | снижает концентрационный риск |

### 3.2 Buyer levers

| Lever | Range | Step | Based on current data |
|---|---:|---:|---|
| Перенос объема на более дешевого поставщика | 0..100% по каждой рекомендации | 5% | `buyer_recommendations.cheaper_alternatives` |
| Перенос объема на надежного поставщика | 0..100% | 5% | `buyer_recommendations.reliable_suppliers` |
| Лимит концентрации по поставщику | 20..80% | 5% | `analytics_modules.buyer.concentration` |

### 3.3 Supplier levers

| Lever | Range | Step | Based on current data |
|---|---:|---:|---|
| Коррекция цены по top overpriced SKU | -20..0% | 1% | `analytics_modules.supplier.price_competitiveness.top_overpriced_skus` |
| Промо-интенсивность на top SKU | 0..20% | 1% | `top_products` + `sales_trends` |
| Снижение pipeline-задержек | 0..50% | 5% | `analytics_modules.supplier.revenue_leakage.pipeline_*` |
| Снижение отмен | 0..50% | 5% | `analytics_modules.supplier.revenue_leakage.cancelled_*` |

## 4. Output Metrics (What moves on screen)

Симулятор должен показывать baseline vs scenario и delta:

| Metric | Unit | Current source |
|---|---|---|
| Прогноз выручки | сом | `total_revenue`, `sales_trends` |
| MoM | % | derived from `sales_trends` |
| Delivery rate | % | `status_funnel` |
| Cancel rate | % | `status_funnel` |
| Market share | % | `market.company_share_pct` |
| Top category share | % | `category_breakdown[0].share_pct` |
| Supplier HHI | 0..1 | `analytics_modules.buyer.concentration.supplier_hhi` |
| Category HHI | 0..1 | `analytics_modules.buyer.concentration.category_hhi` |
| Leakage score | 0..100 | `analytics_modules.supplier.revenue_leakage.leakage_score` |
| Потенциал экономии | сом | buyer cheaper alternatives |
| Retention repeat rate | % | `analytics_modules.supplier.buyer_retention.repeat_rate_pct` |

## 5. Simulation Engine (Deterministic, explainable)

MVP расчет делаем deterministic (не LLM), чтобы результат был предсказуемый и воспроизводимый.

### 5.1 Baseline normalization

- Берем текущий `analytics/summary`.
- Приводим метрики к горизонту (30/60/90) пропорционально.
- Фиксируем baseline snapshot с timestamp.

### 5.2 Delta model (v1)

Примеры формул v1:

- `revenue_after = revenue_base * (1 + demand_uplift + delivery_uplift - cancel_drag - price_drag)`
- `delivery_uplift ~ k1 * max(0, delivery_target - delivery_base)`
- `cancel_drag ~ k2 * max(0, cancel_after - cancel_base)`
- `leakage_after = leakage_base * (1 - leakage_reduction)`
- `buyer_savings = sum(shift_share_i * spend_i * savings_pct_i)`
- `supplier_hhi_after = recompute_hhi(shifted_supplier_shares)`
- `category_hhi_after = recompute_hhi(shifted_category_shares)`

Где коэффициенты `k1/k2` в MVP задаются конфигом и калибруются на demo-data.

### 5.3 Confidence and guardrails

- Confidence score 0..1:
  - выше при наличии достаточного объема данных и нескольких месяцев тренда,
  - ниже при малом количестве заказов.
- Guardrails:
  - clamp на экстремальные значения,
  - предупреждение "оценка ориентировочная", если data quality низкая.

## 6. Frontend UX (wow but practical)

## 6.1 Main layout

- Верх: KPI-strip baseline vs scenario.
- Лево/верх: рычаги (слайдеры и toggles).
- Центр: большой chart compare (до/после).
- Низ: "Почему изменилось" (AI explain panel).

## 6.2 Core interactions

- Realtime recalculation при изменении слайдера (debounce 150-250ms).
- Режимы сравнения:
  - absolute delta (сом, п.п.),
  - relative delta (%).
- Presets:
  - "Антикризис",
  - "Рост выручки",
  - "Снижение риска".
- Undo/redo сценария.

## 6.3 Explainability block

ИИ текстом объясняет TOP-3 драйвера изменения:
- "выручка +7.2% в основном из-за ...",
- "риск снизился из-за падения HHI ...",
- "ограничение эффекта: высокий cancel rate ...".

## 7. API Contract Proposal

Новый endpoint:
- `POST /api/analytics/what-if`

Request:
- `company_id`
- `role`
- `horizon_days`
- `selected_month` (optional baseline anchor)
- `levers` object (all slider values)

Response:
- `baseline` metrics
- `scenario` metrics
- `delta` metrics
- `series_before_after` for charts
- `drivers` (top factors)
- `confidence`
- `warnings`

Optional:
- `POST /api/analytics/what-if/explain` для расширенного narrative.

## 8. Concrete Functions (MVP scope)

1. `Сценарный калькулятор` (core engine, deterministic).
2. `Realtime KPI compare` (baseline/scenario/delta).
3. `Before/After charts` (revenue, delivery, cancel, risk).
4. `Preset scenarios` (3 готовых шаблона).
5. `AI explain block` (top drivers + limits).
6. `Save scenario` (name + timestamp + lever set).
7. `Chat handoff` (кнопка "обсудить этот сценарий в AI чате").

## 9. Out of scope (for later)

- Авто-применение изменений в заказах/ценах.
- Полноценное ML-обучение на исторических данных.
- Оптимизатор "найди лучший план автоматически".

## 10. Rollout Plan

### Phase 1 (Wow MVP, 1 sprint)

- API `/analytics/what-if` + deterministic model.
- Frontend screen "What-if Studio" с 6-8 ключевыми рычагами.
- KPI compare + 2 chart compare + explain block.

### Phase 2 (Power features, next sprint)

- Save/load scenario library.
- Sensitivity view ("какой рычаг дает максимум эффекта").
- Ask -> Auto Chart inside simulator ("покажи вклад факторов по сценарию").

## 11. Acceptance Criteria

1. Пользователь может за 10-20 секунд собрать сценарий и увидеть пересчет KPI.
2. Видно baseline vs scenario с прозрачными дельтами.
3. Есть минимум 3 объясненных драйвера эффекта.
4. Нет авто-действий без явного подтверждения пользователя.
5. Результат повторяем для одинаковых входов (deterministic).
