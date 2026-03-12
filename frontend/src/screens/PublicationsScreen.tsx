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
  description: string;
  shelfLifeDays: string;
  storageCondition: string;
  originCountry: string;
  brand: string;
  manufacturer: string;
  packageType: string;
  netWeightGrams: string;
  allergens: string;
  certifications: string;
  leadTimeDays: string;
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
    shelfLifeDays: "",
    storageCondition: "",
    originCountry: "",
    brand: "",
    manufacturer: "",
    packageType: "",
    netWeightGrams: "",
    allergens: "",
    certifications: "",
    leadTimeDays: "",
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
    description: product.description,
    shelfLifeDays: product.shelfLifeDays == null ? "" : String(product.shelfLifeDays),
    storageCondition: product.storageCondition ?? "",
    originCountry: product.originCountry ?? "",
    brand: product.brand ?? "",
    manufacturer: product.manufacturer ?? "",
    packageType: product.packageType ?? "",
    netWeightGrams: product.netWeightGrams == null ? "" : String(product.netWeightGrams),
    allergens: product.allergens ?? "",
    certifications: product.certifications ?? "",
    leadTimeDays: product.leadTimeDays == null ? "" : String(product.leadTimeDays),
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
  const [expandedProductId, setExpandedProductId] = useState<number | null>(null);

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

    if (draft.description.trim() !== product.description.trim()) return true;
    const shelfLifeDays = parseNumericInput(draft.shelfLifeDays);
    const normalizedShelfLife = shelfLifeDays == null ? null : Math.trunc(shelfLifeDays);
    if (normalizedShelfLife !== product.shelfLifeDays) return true;
    if (draft.storageCondition.trim() !== String(product.storageCondition || "").trim()) return true;
    if (draft.originCountry.trim() !== String(product.originCountry || "").trim()) return true;
    if (draft.brand.trim() !== String(product.brand || "").trim()) return true;
    if (draft.manufacturer.trim() !== String(product.manufacturer || "").trim()) return true;
    if (draft.packageType.trim() !== String(product.packageType || "").trim()) return true;
    if (draft.allergens.trim() !== String(product.allergens || "").trim()) return true;
    if (draft.certifications.trim() !== String(product.certifications || "").trim()) return true;

    const netWeightGrams = parseNumericInput(draft.netWeightGrams);
    const normalizedNetWeightGrams = netWeightGrams == null ? null : Number(netWeightGrams.toFixed(3));
    if (normalizedNetWeightGrams !== product.netWeightGrams) return true;

    const leadTimeDays = parseNumericInput(draft.leadTimeDays);
    const normalizedLeadTimeDays = leadTimeDays == null ? null : Math.trunc(leadTimeDays);
    if (normalizedLeadTimeDays !== product.leadTimeDays) return true;

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
    const nextDescription = draft.description.trim();
    if (nextDescription !== product.description.trim()) payload.description = nextDescription;

    const shelfLifeDays = parseNumericInput(draft.shelfLifeDays);
    if (draft.shelfLifeDays.trim()) {
      if (shelfLifeDays == null || shelfLifeDays < 0) {
        onNotify?.("Срок годности должен быть числом 0 или больше", "error");
        return;
      }
      const normalizedShelfLife = Math.trunc(shelfLifeDays);
      if (normalizedShelfLife !== product.shelfLifeDays) payload.shelf_life_days = normalizedShelfLife;
    } else if (product.shelfLifeDays != null) {
      payload.shelf_life_days = null;
    }

    const nextStorageCondition = draft.storageCondition.trim();
    if (nextStorageCondition !== String(product.storageCondition || "").trim()) {
      payload.storage_condition = nextStorageCondition || null;
    }
    const nextOriginCountry = draft.originCountry.trim();
    if (nextOriginCountry !== String(product.originCountry || "").trim()) {
      payload.origin_country = nextOriginCountry || null;
    }
    const nextBrand = draft.brand.trim();
    if (nextBrand !== String(product.brand || "").trim()) {
      payload.brand = nextBrand || null;
    }
    const nextManufacturer = draft.manufacturer.trim();
    if (nextManufacturer !== String(product.manufacturer || "").trim()) {
      payload.manufacturer = nextManufacturer || null;
    }
    const nextPackageType = draft.packageType.trim();
    if (nextPackageType !== String(product.packageType || "").trim()) {
      payload.package_type = nextPackageType || null;
    }
    const nextAllergens = draft.allergens.trim();
    if (nextAllergens !== String(product.allergens || "").trim()) {
      payload.allergens = nextAllergens || null;
    }
    const nextCertifications = draft.certifications.trim();
    if (nextCertifications !== String(product.certifications || "").trim()) {
      payload.certifications = nextCertifications || null;
    }

    const netWeightGrams = parseNumericInput(draft.netWeightGrams);
    if (draft.netWeightGrams.trim()) {
      if (netWeightGrams == null || netWeightGrams < 0) {
        onNotify?.("Вес нетто должен быть числом 0 или больше", "error");
        return;
      }
      const normalizedNetWeightGrams = Number(netWeightGrams.toFixed(3));
      if (normalizedNetWeightGrams !== product.netWeightGrams) payload.net_weight_grams = normalizedNetWeightGrams;
    } else if (product.netWeightGrams != null) {
      payload.net_weight_grams = null;
    }

    const leadTimeDays = parseNumericInput(draft.leadTimeDays);
    if (draft.leadTimeDays.trim()) {
      if (leadTimeDays == null || leadTimeDays < 0) {
        onNotify?.("Lead time должен быть числом 0 или больше", "error");
        return;
      }
      const normalizedLeadTime = Math.trunc(leadTimeDays);
      if (normalizedLeadTime !== product.leadTimeDays) payload.lead_time_days = normalizedLeadTime;
    } else if (product.leadTimeDays != null) {
      payload.lead_time_days = null;
    }

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
    const shelfLifeDays = parseNumericInput(createForm.shelfLifeDays);
    const netWeightGrams = parseNumericInput(createForm.netWeightGrams);
    const leadTimeDays = parseNumericInput(createForm.leadTimeDays);
    if (createForm.shelfLifeDays.trim() && (shelfLifeDays == null || shelfLifeDays < 0)) {
      onNotify?.("Срок годности должен быть числом 0 или больше", "error");
      return;
    }
    if (createForm.netWeightGrams.trim() && (netWeightGrams == null || netWeightGrams < 0)) {
      onNotify?.("Вес нетто должен быть числом 0 или больше", "error");
      return;
    }
    if (createForm.leadTimeDays.trim() && (leadTimeDays == null || leadTimeDays < 0)) {
      onNotify?.("Lead time должен быть числом 0 или больше", "error");
      return;
    }
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
        shelf_life_days: createForm.shelfLifeDays.trim() ? Math.trunc(shelfLifeDays as number) : undefined,
        storage_condition: createForm.storageCondition.trim() || undefined,
        origin_country: createForm.originCountry.trim() || undefined,
        brand: createForm.brand.trim() || undefined,
        manufacturer: createForm.manufacturer.trim() || undefined,
        package_type: createForm.packageType.trim() || undefined,
        net_weight_grams: createForm.netWeightGrams.trim() ? Number((netWeightGrams as number).toFixed(3)) : undefined,
        allergens: createForm.allergens.trim() || undefined,
        certifications: createForm.certifications.trim() || undefined,
        lead_time_days: createForm.leadTimeDays.trim() ? Math.trunc(leadTimeDays as number) : undefined,
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
                    placeholder="Например: Молоко 3.2% 1 л"
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
                <label className="publication-field">
                  <span>Срок годности (дни)</span>
                  <input
                    inputMode="numeric"
                    value={createForm.shelfLifeDays}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, shelfLifeDays: e.target.value }))}
                    placeholder="Например: 7"
                  />
                </label>
                <label className="publication-field">
                  <span>Условия хранения</span>
                  <input
                    value={createForm.storageCondition}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, storageCondition: e.target.value }))}
                    placeholder="Например: +2...+6°C"
                  />
                </label>
                <label className="publication-field">
                  <span>Страна происхождения</span>
                  <input
                    value={createForm.originCountry}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, originCountry: e.target.value }))}
                    placeholder="Например: Кыргызстан"
                  />
                </label>
                <label className="publication-field">
                  <span>Бренд</span>
                  <input
                    value={createForm.brand}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, brand: e.target.value }))}
                    placeholder="Например: Farm Choice"
                  />
                </label>
                <label className="publication-field">
                  <span>Производитель</span>
                  <input
                    value={createForm.manufacturer}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, manufacturer: e.target.value }))}
                    placeholder="Например: NorthPeak Foods"
                  />
                </label>
                <label className="publication-field">
                  <span>Тип упаковки</span>
                  <input
                    value={createForm.packageType}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, packageType: e.target.value }))}
                    placeholder="Например: Вакуум, коробка, пакет"
                  />
                </label>
                <label className="publication-field">
                  <span>Вес нетто (г)</span>
                  <input
                    inputMode="decimal"
                    value={createForm.netWeightGrams}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, netWeightGrams: e.target.value }))}
                    placeholder="Например: 1000"
                  />
                </label>
                <label className="publication-field">
                  <span>Lead time (дни)</span>
                  <input
                    inputMode="numeric"
                    value={createForm.leadTimeDays}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, leadTimeDays: e.target.value }))}
                    placeholder="Например: 2"
                  />
                </label>
                <label className="publication-field publication-field--wide">
                  <span>Аллергены</span>
                  <input
                    value={createForm.allergens}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, allergens: e.target.value }))}
                    placeholder="Например: лактоза, орехи"
                  />
                </label>
                <label className="publication-field publication-field--wide">
                  <span>Сертификаты</span>
                  <input
                    value={createForm.certifications}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, certifications: e.target.value }))}
                    placeholder="Например: ISO 22000, HACCP"
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
                const isExpanded = expandedProductId === product.id;
                return (
                  <article key={product.id} className={`publication-work-card ${isExpanded ? "is-expanded" : "is-collapsed"}`}>
                    <div className="publication-work-head">
                      <div className="publication-work-summary">
                        <div className="publication-title">{product.name}</div>
                        <div className="publication-subtitle">
                          {product.categoryName || "Без категории"} • {product.unit || "шт"} • мин. заказ {product.minQty}
                        </div>
                        <div className="publication-work-quickmeta">
                          <span>{`Цена: ${draft.price || "—"} сом`}</span>
                          {draft.trackInventory ? <span>{`Остаток: ${draft.stockQty || "0"}`}</span> : <span>Учет склада выкл</span>}
                          {changed ? <span className="is-dirty">Есть изменения</span> : null}
                        </div>
                      </div>
                      <div className="publication-work-side">
                        <div className="publication-status-wrap">
                          <span className={`publication-status ${draft.inStock ? "publication-status--active" : "publication-status--archive"}`}>
                            {draft.inStock ? "В наличии" : "Нет в наличии"}
                          </span>
                          {lowStock ? <span className="publication-status publication-status--draft">Мало остатка</span> : null}
                        </div>
                        <button
                          type="button"
                          className={`publication-expand-btn ${isExpanded ? "is-open" : ""}`}
                          onClick={() => setExpandedProductId((current) => (current === product.id ? null : product.id))}
                          aria-expanded={isExpanded}
                        >
                          {isExpanded ? "Свернуть" : "Открыть"}
                        </button>
                      </div>
                    </div>

                    {isExpanded ? <div className="publication-work-grid">
                      <label className="publication-field">
                        <span>Цена (сом)</span>
                        <input
                          inputMode="decimal"
                          value={draft.price}
                          onChange={(e) => onDraftChange(product.id, { price: e.target.value })}
                          disabled={busy}
                        />
                      </label>

                      <label className="publication-field publication-field--wide">
                        <span>Описание</span>
                        <textarea
                          rows={2}
                          value={draft.description}
                          onChange={(e) => onDraftChange(product.id, { description: e.target.value })}
                          disabled={busy}
                        />
                      </label>

                      <label className="publication-field">
                        <span>Срок годности (дни)</span>
                        <input
                          inputMode="numeric"
                          value={draft.shelfLifeDays}
                          onChange={(e) => onDraftChange(product.id, { shelfLifeDays: e.target.value })}
                          disabled={busy}
                        />
                      </label>

                      <label className="publication-field">
                        <span>Условия хранения</span>
                        <input
                          value={draft.storageCondition}
                          onChange={(e) => onDraftChange(product.id, { storageCondition: e.target.value })}
                          disabled={busy}
                        />
                      </label>

                      <label className="publication-field">
                        <span>Страна происхождения</span>
                        <input
                          value={draft.originCountry}
                          onChange={(e) => onDraftChange(product.id, { originCountry: e.target.value })}
                          disabled={busy}
                        />
                      </label>
                      <label className="publication-field">
                        <span>Бренд</span>
                        <input
                          value={draft.brand}
                          onChange={(e) => onDraftChange(product.id, { brand: e.target.value })}
                          disabled={busy}
                        />
                      </label>
                      <label className="publication-field">
                        <span>Производитель</span>
                        <input
                          value={draft.manufacturer}
                          onChange={(e) => onDraftChange(product.id, { manufacturer: e.target.value })}
                          disabled={busy}
                        />
                      </label>
                      <label className="publication-field">
                        <span>Тип упаковки</span>
                        <input
                          value={draft.packageType}
                          onChange={(e) => onDraftChange(product.id, { packageType: e.target.value })}
                          disabled={busy}
                        />
                      </label>
                      <label className="publication-field">
                        <span>Вес нетто (г)</span>
                        <input
                          inputMode="decimal"
                          value={draft.netWeightGrams}
                          onChange={(e) => onDraftChange(product.id, { netWeightGrams: e.target.value })}
                          disabled={busy}
                        />
                      </label>
                      <label className="publication-field">
                        <span>Lead time (дни)</span>
                        <input
                          inputMode="numeric"
                          value={draft.leadTimeDays}
                          onChange={(e) => onDraftChange(product.id, { leadTimeDays: e.target.value })}
                          disabled={busy}
                        />
                      </label>
                      <label className="publication-field publication-field--wide">
                        <span>Аллергены</span>
                        <input
                          value={draft.allergens}
                          onChange={(e) => onDraftChange(product.id, { allergens: e.target.value })}
                          disabled={busy}
                        />
                      </label>
                      <label className="publication-field publication-field--wide">
                        <span>Сертификаты</span>
                        <input
                          value={draft.certifications}
                          onChange={(e) => onDraftChange(product.id, { certifications: e.target.value })}
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
                    </div> : null}

                    {isExpanded ? <div className="publication-work-actions">
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
                    </div> : null}
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
