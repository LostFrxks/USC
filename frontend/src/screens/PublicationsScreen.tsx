import { useEffect, useMemo, useState } from "react";
import { fetchCategories, type CategoryApi } from "../api/categories";
import { isApiError } from "../api/client";
import {
  createSupplierProduct,
  deleteSupplierProduct,
  fetchMySupplierProducts,
  updateSupplierProduct,
  type SupplierProduct,
} from "../api/products";
import type { ToastTone } from "../hooks/useToast";
import SecondaryTopbar from "../ui/SecondaryTopbar";

type ProductFilter = "all" | "in_stock" | "out_stock" | "low_stock";

type ProductDraft = {
  price: string;
  inStock: boolean;
  trackInventory: boolean;
  stockQty: string;
};

function makeDefaultCreateForm() {
  return {
    name: "",
    categoryId: "",
    description: "",
    price: "",
    unit: "шт",
    minQty: "1",
    inStock: true,
    trackInventory: false,
    stockQty: "",
  };
}

function formatMoney(value: number): string {
  return `${Math.round(value).toLocaleString("ru-RU")} сом`;
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const text = value.toFixed(2);
  return text.endsWith(".00") ? String(Math.round(value)) : text;
}

function parseNumericInput(raw: string): number | null {
  const normalized = raw.replace(",", ".").trim();
  if (!normalized) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return value;
}

function buildDraft(product: SupplierProduct): ProductDraft {
  return {
    price: formatNumber(product.price),
    inStock: product.inStock,
    trackInventory: product.trackInventory,
    stockQty: product.stockQty == null ? "" : formatNumber(product.stockQty),
  };
}

function isLowStock(product: SupplierProduct, draft?: ProductDraft): boolean {
  const track = draft?.trackInventory ?? product.trackInventory;
  const inStock = draft?.inStock ?? product.inStock;
  const stockQtyRaw = draft?.stockQty ?? (product.stockQty == null ? "" : String(product.stockQty));
  const stockQty = parseNumericInput(stockQtyRaw);
  if (!track || !inStock || stockQty == null) return false;
  const minQty = Math.max(1, Number(product.minQty || 1));
  return stockQty <= minQty * 2;
}

export default function PublicationsScreen({
  active,
  onBurger,
  onOpenNotifications,
  notificationCount,
  role,
  companyId,
  showCompanyBanner,
  onPickCompany,
  onNotify,
}: {
  active: boolean;
  onBurger: () => void;
  onOpenNotifications?: () => void;
  notificationCount?: number;
  role?: "buyer" | "supplier" | null;
  companyId?: number | null;
  showCompanyBanner?: boolean;
  onPickCompany?: () => void;
  onNotify?: (message: string, tone?: ToastTone) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [categories, setCategories] = useState<CategoryApi[]>([]);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ProductFilter>("all");
  const [drafts, setDrafts] = useState<Record<number, ProductDraft>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(makeDefaultCreateForm);

  const isSupplier = (role || "").toLowerCase() === "supplier";
  const canLoadData = active && isSupplier && !!companyId;

  useEffect(() => {
    if (!canLoadData) return;
    let alive = true;
    setLoading(true);
    setErrorText(null);

    Promise.all([fetchMySupplierProducts(companyId), fetchCategories()])
      .then(([productRows, categoryRows]) => {
        if (!alive) return;
        setProducts(productRows);
        setCategories(categoryRows);
        setDrafts(Object.fromEntries(productRows.map((row) => [row.id, buildDraft(row)])));
      })
      .catch((error: unknown) => {
        if (!alive) return;
        if (isApiError(error) && error.status === 403) {
          setErrorText("Эта компания не является поставщиком. Выберите компанию-поставщика.");
          return;
        }
        if (isApiError(error)) {
          setErrorText(`Ошибка API: ${error.status}`);
          return;
        }
        setErrorText("Не удалось загрузить публикации поставщика.");
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [canLoadData, companyId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((product) => {
      const draft = drafts[product.id];
      const name = product.name.toLowerCase();
      const desc = product.description.toLowerCase();
      const cat = String(product.categoryName || "").toLowerCase();
      const matchSearch = !q || name.includes(q) || desc.includes(q) || cat.includes(q);
      if (!matchSearch) return false;

      const inStock = draft?.inStock ?? product.inStock;
      if (filter === "in_stock") return inStock;
      if (filter === "out_stock") return !inStock;
      if (filter === "low_stock") return isLowStock(product, draft);
      return true;
    });
  }, [products, drafts, search, filter]);

  const stats = useMemo(() => {
    const all = products.length;
    let inStock = 0;
    let lowStock = 0;
    let inventoryValue = 0;

    for (const product of products) {
      const draft = drafts[product.id];
      const draftInStock = draft?.inStock ?? product.inStock;
      if (draftInStock) inStock += 1;
      if (isLowStock(product, draft)) lowStock += 1;

      const track = draft?.trackInventory ?? product.trackInventory;
      const stockQtyRaw = draft?.stockQty ?? (product.stockQty == null ? "" : String(product.stockQty));
      const stockQty = parseNumericInput(stockQtyRaw);
      const price = parseNumericInput(draft?.price ?? String(product.price)) ?? product.price;
      if (track && stockQty != null && stockQty > 0) {
        inventoryValue += price * stockQty;
      }
    }

    return {
      all,
      inStock,
      outOfStock: Math.max(0, all - inStock),
      lowStock,
      inventoryValue,
    };
  }, [products, drafts]);

  function onDraftChange(productId: number, patch: Partial<ProductDraft>) {
    setDrafts((prev) => {
      const existingDraft = prev[productId];
      const product = products.find((x) => x.id === productId);
      if (!existingDraft && !product) return prev;
      const baseDraft = existingDraft ?? buildDraft(product as SupplierProduct);
      return { ...prev, [productId]: { ...baseDraft, ...patch } };
    });
  }

  function hasChanges(product: SupplierProduct): boolean {
    const draft = drafts[product.id];
    if (!draft) return false;

    const price = parseNumericInput(draft.price);
    const productPrice = Number(product.price);
    if (price != null && Math.abs(price - productPrice) > 0.0001) return true;
    if (draft.inStock !== product.inStock) return true;
    if (draft.trackInventory !== product.trackInventory) return true;

    const stockQty = parseNumericInput(draft.stockQty);
    const productStock = product.stockQty;
    const normalizedStock = stockQty == null ? null : stockQty;
    if (normalizedStock !== productStock) return true;

    return false;
  }

  async function handleSave(product: SupplierProduct) {
    const draft = drafts[product.id];
    if (!draft || savingId != null || deletingId != null) return;

    const payload: Record<string, unknown> = {};
    const price = parseNumericInput(draft.price);
    if (price == null || price <= 0) {
      onNotify?.("Цена должна быть больше нуля", "error");
      return;
    }
    if (Math.abs(price - product.price) > 0.0001) payload.price = price;
    if (draft.inStock !== product.inStock) payload.in_stock = draft.inStock;
    if (draft.trackInventory !== product.trackInventory) payload.track_inventory = draft.trackInventory;

    const stockQty = parseNumericInput(draft.stockQty);
    if (draft.trackInventory) {
      if (stockQty == null || stockQty < 0) {
        onNotify?.("Укажите корректный остаток (0 или больше)", "error");
        return;
      }
      if (stockQty !== product.stockQty) payload.stock_qty = stockQty;
    }

    if (Object.keys(payload).length === 0) {
      onNotify?.("Изменений нет", "info");
      return;
    }

    setSavingId(product.id);
    try {
      const updated = await updateSupplierProduct(product.id, payload);
      setProducts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setDrafts((prev) => ({ ...prev, [updated.id]: buildDraft(updated) }));
      onNotify?.(`Сохранено: ${updated.name}`, "success");
    } catch (error: unknown) {
      if (isApiError(error)) onNotify?.(`Ошибка сохранения (${error.status})`, "error");
      else onNotify?.("Не удалось сохранить изменения", "error");
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(product: SupplierProduct) {
    if (savingId != null || deletingId != null) return;
    const ok = window.confirm(`Удалить публикацию "${product.name}"?`);
    if (!ok) return;
    setDeletingId(product.id);
    try {
      await deleteSupplierProduct(product.id);
      setProducts((prev) => prev.filter((item) => item.id !== product.id));
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[product.id];
        return next;
      });
      onNotify?.(`Удалено: ${product.name}`, "success");
    } catch (error: unknown) {
      if (isApiError(error)) onNotify?.(`Ошибка удаления (${error.status})`, "error");
      else onNotify?.("Не удалось удалить публикацию", "error");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleCreate() {
    if (!companyId || creating) return;
    const name = createForm.name.trim();
    if (!name) {
      onNotify?.("Введите название товара", "error");
      return;
    }
    const price = parseNumericInput(createForm.price);
    if (price == null || price <= 0) {
      onNotify?.("Укажите корректную цену", "error");
      return;
    }
    const minQty = parseNumericInput(createForm.minQty);
    if (minQty == null || minQty <= 0) {
      onNotify?.("Минимальный заказ должен быть больше 0", "error");
      return;
    }
    const stockQty = parseNumericInput(createForm.stockQty);
    if (createForm.trackInventory && (stockQty == null || stockQty < 0)) {
      onNotify?.("Для учета склада укажите остаток 0 или больше", "error");
      return;
    }

    setCreating(true);
    try {
      const created = await createSupplierProduct({
        supplier_company_id: companyId,
        category_id: createForm.categoryId ? Number(createForm.categoryId) : undefined,
        name,
        description: createForm.description.trim(),
        price,
        unit: createForm.unit.trim() || "шт",
        min_qty: minQty,
        in_stock: createForm.inStock,
        track_inventory: createForm.trackInventory,
        stock_qty: createForm.trackInventory ? stockQty ?? 0 : undefined,
      });

      setProducts((prev) => [created, ...prev]);
      setDrafts((prev) => ({ ...prev, [created.id]: buildDraft(created) }));
      setCreateForm(makeDefaultCreateForm());
      setCreateOpen(false);
      onNotify?.(`Публикация добавлена: ${created.name}`, "success");
    } catch (error: unknown) {
      if (isApiError(error)) onNotify?.(`Ошибка создания (${error.status})`, "error");
      else onNotify?.("Не удалось создать публикацию", "error");
    } finally {
      setCreating(false);
    }
  }

  return (
    <section id="screen-publications" className={`screen ${active ? "active" : ""}`}>
      <SecondaryTopbar onBurger={onBurger} onNotifications={onOpenNotifications} notificationCount={notificationCount} />

      <header className="simple-header">
        <div className="simple-title">Ваши публикации</div>
      </header>

      {!isSupplier ? (
        <div className="publications-empty">
          <div className="publications-empty-title">Раздел доступен только поставщику</div>
          <div className="publications-empty-text">
            Для покупателей здесь нет действий. Переключите роль или компанию на поставщика.
          </div>
          {onPickCompany ? (
            <button type="button" className="publication-primary-btn" onClick={onPickCompany}>
              Выбрать компанию
            </button>
          ) : null}
        </div>
      ) : showCompanyBanner ? (
        <div className="publications-empty">
          <div className="publications-empty-title">Сначала выберите компанию</div>
          <div className="publications-empty-text">После выбора компании загрузятся ваши реальные товары.</div>
          {onPickCompany ? (
            <button type="button" className="publication-primary-btn" onClick={onPickCompany}>
              Выбрать компанию
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <div className="publications-hero publications-hero--work">
            <div>
              <div className="publications-hero-title">Кабинет поставщика</div>
              <div className="publications-hero-sub">Управляйте ценой, остатками и наличием в одном месте</div>
            </div>
            <div className="publications-hero-actions">
              <button
                className="publication-secondary-btn"
                type="button"
                onClick={() => setCreateOpen((x) => !x)}
                disabled={!companyId || creating}
              >
                {createOpen ? "Скрыть форму" : "Добавить SKU"}
              </button>
              <button
                className="publication-primary-btn"
                type="button"
                onClick={() => {
                  if (!companyId) return;
                  setLoading(true);
                  fetchMySupplierProducts(companyId)
                    .then((rows) => {
                      setProducts(rows);
                      setDrafts(Object.fromEntries(rows.map((row) => [row.id, buildDraft(row)])));
                      setErrorText(null);
                    })
                    .catch(() => setErrorText("Не удалось обновить список публикаций"))
                    .finally(() => setLoading(false));
                }}
              >
                Обновить
              </button>
            </div>
          </div>

          <div className="publications-stats">
            <div className="publication-kpi">
              <div className="publication-kpi-label">Всего SKU</div>
              <div className="publication-kpi-value">{stats.all}</div>
            </div>
            <div className="publication-kpi">
              <div className="publication-kpi-label">В наличии</div>
              <div className="publication-kpi-value">{stats.inStock}</div>
            </div>
            <div className="publication-kpi">
              <div className="publication-kpi-label">Заканчиваются</div>
              <div className="publication-kpi-value">{stats.lowStock}</div>
            </div>
            <div className="publication-kpi">
              <div className="publication-kpi-label">Оценка остатка</div>
              <div className="publication-kpi-value">{formatMoney(stats.inventoryValue)}</div>
            </div>
          </div>

          {createOpen ? (
            <div className="publication-create-card">
              <div className="publication-create-title">Новая публикация</div>
              <div className="publication-form-grid">
                <label className="publication-field publication-field--wide">
                  <span>Название товара</span>
                  <input
                    value={createForm.name}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Например: Молоко 3.2% 1л"
                  />
                </label>
                <label className="publication-field">
                  <span>Категория</span>
                  <select
                    value={createForm.categoryId}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, categoryId: e.target.value }))}
                  >
                    <option value="">Без категории</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="publication-field">
                  <span>Цена (сом)</span>
                  <input
                    inputMode="decimal"
                    value={createForm.price}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, price: e.target.value }))}
                    placeholder="0"
                  />
                </label>
                <label className="publication-field">
                  <span>Ед. изм.</span>
                  <input
                    value={createForm.unit}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, unit: e.target.value }))}
                    placeholder="кг / шт / л"
                  />
                </label>
                <label className="publication-field">
                  <span>Мин. заказ</span>
                  <input
                    inputMode="decimal"
                    value={createForm.minQty}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, minQty: e.target.value }))}
                    placeholder="1"
                  />
                </label>
                <label className="publication-field publication-field--wide">
                  <span>Описание</span>
                  <textarea
                    rows={2}
                    value={createForm.description}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Кратко: упаковка, срок поставки, условия"
                  />
                </label>
              </div>

              <div className="publication-create-switches">
                <label>
                  <input
                    type="checkbox"
                    checked={createForm.inStock}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, inStock: e.target.checked }))}
                  />
                  В наличии
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={createForm.trackInventory}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, trackInventory: e.target.checked }))}
                  />
                  Учет остатков
                </label>
                {createForm.trackInventory ? (
                  <label className="publication-field publication-field--stock">
                    <span>Остаток</span>
                    <input
                      inputMode="decimal"
                      value={createForm.stockQty}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, stockQty: e.target.value }))}
                      placeholder="0"
                    />
                  </label>
                ) : null}
              </div>

              <div className="publication-create-actions">
                <button type="button" className="publication-primary-btn" onClick={handleCreate} disabled={creating}>
                  {creating ? "Создание..." : "Создать публикацию"}
                </button>
              </div>
            </div>
          ) : null}

          <div className="search-box publications-search">
            <span>🔎</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по SKU, описанию, категории" />
            {search ? (
              <button className="clear-search" type="button" onClick={() => setSearch("")}>
                ×
              </button>
            ) : null}
          </div>

          <div className="publications-filters">
            {[
              { key: "all", label: `Все (${stats.all})` },
              { key: "in_stock", label: `В наличии (${stats.inStock})` },
              { key: "out_stock", label: `Нет в наличии (${stats.outOfStock})` },
              { key: "low_stock", label: `Заканчиваются (${stats.lowStock})` },
            ].map((chip) => (
              <button
                key={chip.key}
                type="button"
                className={`filter-btn ${filter === chip.key ? "active" : ""}`}
                onClick={() => setFilter(chip.key as ProductFilter)}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="publications-empty">
              <div className="publications-empty-title">Загрузка публикаций...</div>
            </div>
          ) : errorText ? (
            <div className="publications-empty">
              <div className="publications-empty-title">Не удалось загрузить данные</div>
              <div className="publications-empty-text">{errorText}</div>
              {onPickCompany ? (
                <button type="button" className="publication-primary-btn" onClick={onPickCompany}>
                  Выбрать другую компанию
                </button>
              ) : null}
            </div>
          ) : filtered.length === 0 ? (
            <div className="publications-empty">
              <div className="publications-empty-title">Ничего не найдено</div>
              <div className="publications-empty-text">Измените фильтр или добавьте новую публикацию.</div>
            </div>
          ) : (
            <div className="publications-list publications-list--work">
              {filtered.map((product) => {
                const draft = drafts[product.id] ?? buildDraft(product);
                const changed = hasChanges(product);
                const busy = savingId === product.id || deletingId === product.id;
                const lowStock = isLowStock(product, draft);
                return (
                  <article key={product.id} className="publication-work-card">
                    <div className="publication-work-head">
                      <div>
                        <div className="publication-title">{product.name}</div>
                        <div className="publication-subtitle">
                          {product.categoryName || "Без категории"} • {product.unit || "шт"} • мин. заказ {product.minQty}
                        </div>
                      </div>
                      <div className="publication-status-wrap">
                        <span className={`publication-status ${draft.inStock ? "publication-status--active" : "publication-status--archive"}`}>
                          {draft.inStock ? "В наличии" : "Нет в наличии"}
                        </span>
                        {lowStock ? <span className="publication-status publication-status--draft">Мало остатка</span> : null}
                      </div>
                    </div>

                    <div className="publication-work-grid">
                      <label className="publication-field">
                        <span>Цена (сом)</span>
                        <input
                          inputMode="decimal"
                          value={draft.price}
                          onChange={(e) => onDraftChange(product.id, { price: e.target.value })}
                          disabled={busy}
                        />
                      </label>

                      <label className="publication-field">
                        <span>Наличие</span>
                        <button
                          type="button"
                          className={`publication-toggle ${draft.inStock ? "is-on" : ""}`}
                          onClick={() => onDraftChange(product.id, { inStock: !draft.inStock })}
                          disabled={busy}
                        >
                          {draft.inStock ? "Включено" : "Выключено"}
                        </button>
                      </label>

                      <label className="publication-field">
                        <span>Учет склада</span>
                        <button
                          type="button"
                          className={`publication-toggle ${draft.trackInventory ? "is-on" : ""}`}
                          onClick={() => onDraftChange(product.id, { trackInventory: !draft.trackInventory })}
                          disabled={busy}
                        >
                          {draft.trackInventory ? "Включено" : "Выключено"}
                        </button>
                      </label>

                      <label className="publication-field">
                        <span>Остаток</span>
                        <input
                          inputMode="decimal"
                          value={draft.stockQty}
                          onChange={(e) => onDraftChange(product.id, { stockQty: e.target.value })}
                          disabled={!draft.trackInventory || busy}
                          placeholder={draft.trackInventory ? "0" : "Учет выключен"}
                        />
                      </label>
                    </div>

                    <div className="publication-work-actions">
                      <button
                        type="button"
                        className="publication-primary-btn"
                        disabled={!changed || busy}
                        onClick={() => handleSave(product)}
                      >
                        {savingId === product.id ? "Сохранение..." : "Сохранить"}
                      </button>
                      <button
                        type="button"
                        className="publication-danger-btn"
                        disabled={busy}
                        onClick={() => handleDelete(product)}
                      >
                        {deletingId === product.id ? "Удаление..." : "Удалить"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}
