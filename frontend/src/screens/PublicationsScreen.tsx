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
    unit: "С€С‚",
    minQty: "1",
    inStock: true,
    trackInventory: false,
    stockQty: "",
  };
}

function formatMoney(value: number): string {
  return `${Math.round(value).toLocaleString("ru-RU")} СЃРѕРј`;
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
          setErrorText("Р­С‚Р° РєРѕРјРїР°РЅРёСЏ РЅРµ СЏРІР»СЏРµС‚СЃСЏ РїРѕСЃС‚Р°РІС‰РёРєРѕРј. Р’С‹Р±РµСЂРёС‚Рµ РєРѕРјРїР°РЅРёСЋ-РїРѕСЃС‚Р°РІС‰РёРєР°.");
          return;
        }
        if (isApiError(error)) {
          setErrorText(`РћС€РёР±РєР° API: ${error.status}`);
          return;
        }
        setErrorText("РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ РїСѓР±Р»РёРєР°С†РёРё РїРѕСЃС‚Р°РІС‰РёРєР°.");
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
        onNotify?.("РЎСЂРѕРє РіРѕРґРЅРѕСЃС‚Рё РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ С‡РёСЃР»РѕРј 0 РёР»Рё Р±РѕР»СЊС€Рµ", "error");
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
      onNotify?.("Р¦РµРЅР° РґРѕР»Р¶РЅР° Р±С‹С‚СЊ Р±РѕР»СЊС€Рµ РЅСѓР»СЏ", "error");
      return;
    }
    if (Math.abs(price - product.price) > 0.0001) payload.price = price;
    if (draft.inStock !== product.inStock) payload.in_stock = draft.inStock;
    if (draft.trackInventory !== product.trackInventory) payload.track_inventory = draft.trackInventory;

    const stockQty = parseNumericInput(draft.stockQty);
    if (draft.trackInventory) {
      if (stockQty == null || stockQty < 0) {
        onNotify?.("РЈРєР°Р¶РёС‚Рµ РєРѕСЂСЂРµРєС‚РЅС‹Р№ РѕСЃС‚Р°С‚РѕРє (0 РёР»Рё Р±РѕР»СЊС€Рµ)", "error");
        return;
      }
      if (stockQty !== product.stockQty) payload.stock_qty = stockQty;
    }

    if (Object.keys(payload).length === 0) {
      onNotify?.("РР·РјРµРЅРµРЅРёР№ РЅРµС‚", "info");
      return;
    }

    setSavingId(product.id);
    try {
      const updated = await updateSupplierProduct(product.id, payload);
      setProducts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setDrafts((prev) => ({ ...prev, [updated.id]: buildDraft(updated) }));
      onNotify?.(`РЎРѕС…СЂР°РЅРµРЅРѕ: ${updated.name}`, "success");
    } catch (error: unknown) {
      if (isApiError(error)) onNotify?.(`РћС€РёР±РєР° СЃРѕС…СЂР°РЅРµРЅРёСЏ (${error.status})`, "error");
      else onNotify?.("РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕС…СЂР°РЅРёС‚СЊ РёР·РјРµРЅРµРЅРёСЏ", "error");
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(product: SupplierProduct) {
    if (savingId != null || deletingId != null) return;
    const ok = window.confirm(`РЈРґР°Р»РёС‚СЊ РїСѓР±Р»РёРєР°С†РёСЋ "${product.name}"?`);
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
      onNotify?.(`РЈРґР°Р»РµРЅРѕ: ${product.name}`, "success");
    } catch (error: unknown) {
      if (isApiError(error)) onNotify?.(`РћС€РёР±РєР° СѓРґР°Р»РµРЅРёСЏ (${error.status})`, "error");
      else onNotify?.("РќРµ СѓРґР°Р»РѕСЃСЊ СѓРґР°Р»РёС‚СЊ РїСѓР±Р»РёРєР°С†РёСЋ", "error");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleCreate() {
    if (!companyId || creating) return;
    const name = createForm.name.trim();
    if (!name) {
      onNotify?.("Р’РІРµРґРёС‚Рµ РЅР°Р·РІР°РЅРёРµ С‚РѕРІР°СЂР°", "error");
      return;
    }
    const price = parseNumericInput(createForm.price);
    if (price == null || price <= 0) {
      onNotify?.("РЈРєР°Р¶РёС‚Рµ РєРѕСЂСЂРµРєС‚РЅСѓСЋ С†РµРЅСѓ", "error");
      return;
    }
    const minQty = parseNumericInput(createForm.minQty);
    if (minQty == null || minQty <= 0) {
      onNotify?.("РњРёРЅРёРјР°Р»СЊРЅС‹Р№ Р·Р°РєР°Р· РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ Р±РѕР»СЊС€Рµ 0", "error");
      return;
    }
    const stockQty = parseNumericInput(createForm.stockQty);
    const shelfLifeDays = parseNumericInput(createForm.shelfLifeDays);
    const netWeightGrams = parseNumericInput(createForm.netWeightGrams);
    const leadTimeDays = parseNumericInput(createForm.leadTimeDays);
    if (createForm.shelfLifeDays.trim() && (shelfLifeDays == null || shelfLifeDays < 0)) {
      onNotify?.("РЎСЂРѕРє РіРѕРґРЅРѕСЃС‚Рё РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ С‡РёСЃР»РѕРј 0 РёР»Рё Р±РѕР»СЊС€Рµ", "error");
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
      onNotify?.("Р”Р»СЏ СѓС‡РµС‚Р° СЃРєР»Р°РґР° СѓРєР°Р¶РёС‚Рµ РѕСЃС‚Р°С‚РѕРє 0 РёР»Рё Р±РѕР»СЊС€Рµ", "error");
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
        unit: createForm.unit.trim() || "С€С‚",
        min_qty: minQty,
        in_stock: createForm.inStock,
        track_inventory: createForm.trackInventory,
        stock_qty: createForm.trackInventory ? stockQty ?? 0 : undefined,
      });

      setProducts((prev) => [created, ...prev]);
      setDrafts((prev) => ({ ...prev, [created.id]: buildDraft(created) }));
      setCreateForm(makeDefaultCreateForm());
      setCreateOpen(false);
      onNotify?.(`РџСѓР±Р»РёРєР°С†РёСЏ РґРѕР±Р°РІР»РµРЅР°: ${created.name}`, "success");
    } catch (error: unknown) {
      if (isApiError(error)) onNotify?.(`РћС€РёР±РєР° СЃРѕР·РґР°РЅРёСЏ (${error.status})`, "error");
      else onNotify?.("РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕР·РґР°С‚СЊ РїСѓР±Р»РёРєР°С†РёСЋ", "error");
    } finally {
      setCreating(false);
    }
  }

  return (
    <section id="screen-publications" className={`screen ${active ? "active" : ""}`}>
      <SecondaryTopbar onBurger={onBurger} onNotifications={onOpenNotifications} notificationCount={notificationCount} />

      <header className="simple-header">
        <div className="simple-title">Р’Р°С€Рё РїСѓР±Р»РёРєР°С†РёРё</div>
      </header>

      {!isSupplier ? (
        <div className="publications-empty">
          <div className="publications-empty-title">Р Р°Р·РґРµР» РґРѕСЃС‚СѓРїРµРЅ С‚РѕР»СЊРєРѕ РїРѕСЃС‚Р°РІС‰РёРєСѓ</div>
          <div className="publications-empty-text">
            Р”Р»СЏ РїРѕРєСѓРїР°С‚РµР»РµР№ Р·РґРµСЃСЊ РЅРµС‚ РґРµР№СЃС‚РІРёР№. РџРµСЂРµРєР»СЋС‡РёС‚Рµ СЂРѕР»СЊ РёР»Рё РєРѕРјРїР°РЅРёСЋ РЅР° РїРѕСЃС‚Р°РІС‰РёРєР°.
          </div>
          {onPickCompany ? (
            <button type="button" className="publication-primary-btn" onClick={onPickCompany}>
              Р’С‹Р±СЂР°С‚СЊ РєРѕРјРїР°РЅРёСЋ
            </button>
          ) : null}
        </div>
      ) : showCompanyBanner ? (
        <div className="publications-empty">
          <div className="publications-empty-title">РЎРЅР°С‡Р°Р»Р° РІС‹Р±РµСЂРёС‚Рµ РєРѕРјРїР°РЅРёСЋ</div>
          <div className="publications-empty-text">РџРѕСЃР»Рµ РІС‹Р±РѕСЂР° РєРѕРјРїР°РЅРёРё Р·Р°РіСЂСѓР·СЏС‚СЃСЏ РІР°С€Рё СЂРµР°Р»СЊРЅС‹Рµ С‚РѕРІР°СЂС‹.</div>
          {onPickCompany ? (
            <button type="button" className="publication-primary-btn" onClick={onPickCompany}>
              Р’С‹Р±СЂР°С‚СЊ РєРѕРјРїР°РЅРёСЋ
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <div className="publications-hero publications-hero--work">
            <div>
              <div className="publications-hero-title">РљР°Р±РёРЅРµС‚ РїРѕСЃС‚Р°РІС‰РёРєР°</div>
              <div className="publications-hero-sub">РЈРїСЂР°РІР»СЏР№С‚Рµ С†РµРЅРѕР№, РѕСЃС‚Р°С‚РєР°РјРё Рё РЅР°Р»РёС‡РёРµРј РІ РѕРґРЅРѕРј РјРµСЃС‚Рµ</div>
            </div>
            <div className="publications-hero-actions">
              <button
                className="publication-secondary-btn"
                type="button"
                onClick={() => setCreateOpen((x) => !x)}
                disabled={!companyId || creating}
              >
                {createOpen ? "РЎРєСЂС‹С‚СЊ С„РѕСЂРјСѓ" : "Р”РѕР±Р°РІРёС‚СЊ SKU"}
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
                    .catch(() => setErrorText("РќРµ СѓРґР°Р»РѕСЃСЊ РѕР±РЅРѕРІРёС‚СЊ СЃРїРёСЃРѕРє РїСѓР±Р»РёРєР°С†РёР№"))
                    .finally(() => setLoading(false));
                }}
              >
                РћР±РЅРѕРІРёС‚СЊ
              </button>
            </div>
          </div>

          <div className="publications-stats">
            <div className="publication-kpi">
              <div className="publication-kpi-label">Р’СЃРµРіРѕ SKU</div>
              <div className="publication-kpi-value">{stats.all}</div>
            </div>
            <div className="publication-kpi">
              <div className="publication-kpi-label">Р’ РЅР°Р»РёС‡РёРё</div>
              <div className="publication-kpi-value">{stats.inStock}</div>
            </div>
            <div className="publication-kpi">
              <div className="publication-kpi-label">Р—Р°РєР°РЅС‡РёРІР°СЋС‚СЃСЏ</div>
              <div className="publication-kpi-value">{stats.lowStock}</div>
            </div>
            <div className="publication-kpi">
              <div className="publication-kpi-label">РћС†РµРЅРєР° РѕСЃС‚Р°С‚РєР°</div>
              <div className="publication-kpi-value">{formatMoney(stats.inventoryValue)}</div>
            </div>
          </div>

          {createOpen ? (
            <div className="publication-create-card">
              <div className="publication-create-title">РќРѕРІР°СЏ РїСѓР±Р»РёРєР°С†РёСЏ</div>
              <div className="publication-form-grid">
                <label className="publication-field publication-field--wide">
                  <span>РќР°Р·РІР°РЅРёРµ С‚РѕРІР°СЂР°</span>
                  <input
                    value={createForm.name}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="РќР°РїСЂРёРјРµСЂ: РњРѕР»РѕРєРѕ 3.2% 1Р»"
                  />
                </label>
                <label className="publication-field">
                  <span>РљР°С‚РµРіРѕСЂРёСЏ</span>
                  <select
                    value={createForm.categoryId}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, categoryId: e.target.value }))}
                  >
                    <option value="">Р‘РµР· РєР°С‚РµРіРѕСЂРёРё</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="publication-field">
                  <span>Р¦РµРЅР° (СЃРѕРј)</span>
                  <input
                    inputMode="decimal"
                    value={createForm.price}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, price: e.target.value }))}
                    placeholder="0"
                  />
                </label>
                <label className="publication-field">
                  <span>Р•Рґ. РёР·Рј.</span>
                  <input
                    value={createForm.unit}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, unit: e.target.value }))}
                    placeholder="РєРі / С€С‚ / Р»"
                  />
                </label>
                <label className="publication-field">
                  <span>РњРёРЅ. Р·Р°РєР°Р·</span>
                  <input
                    inputMode="decimal"
                    value={createForm.minQty}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, minQty: e.target.value }))}
                    placeholder="1"
                  />
                </label>
                <label className="publication-field publication-field--wide">
                  <span>РћРїРёСЃР°РЅРёРµ</span>
                  <textarea
                    rows={2}
                    value={createForm.description}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="РљСЂР°С‚РєРѕ: СѓРїР°РєРѕРІРєР°, СЃСЂРѕРє РїРѕСЃС‚Р°РІРєРё, СѓСЃР»РѕРІРёСЏ"
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
                  Р’ РЅР°Р»РёС‡РёРё
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={createForm.trackInventory}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, trackInventory: e.target.checked }))}
                  />
                  РЈС‡РµС‚ РѕСЃС‚Р°С‚РєРѕРІ
                </label>
                {createForm.trackInventory ? (
                  <label className="publication-field publication-field--stock">
                    <span>РћСЃС‚Р°С‚РѕРє</span>
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
                  {creating ? "РЎРѕР·РґР°РЅРёРµ..." : "РЎРѕР·РґР°С‚СЊ РїСѓР±Р»РёРєР°С†РёСЋ"}
                </button>
              </div>
            </div>
          ) : null}

          <div className="search-box publications-search">
            <span>рџ”Ћ</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="РџРѕРёСЃРє РїРѕ SKU, РѕРїРёСЃР°РЅРёСЋ, РєР°С‚РµРіРѕСЂРёРё" />
            {search ? (
              <button className="clear-search" type="button" onClick={() => setSearch("")}>
                Г—
              </button>
            ) : null}
          </div>

          <div className="publications-filters">
            {[
              { key: "all", label: `Р’СЃРµ (${stats.all})` },
              { key: "in_stock", label: `Р’ РЅР°Р»РёС‡РёРё (${stats.inStock})` },
              { key: "out_stock", label: `РќРµС‚ РІ РЅР°Р»РёС‡РёРё (${stats.outOfStock})` },
              { key: "low_stock", label: `Р—Р°РєР°РЅС‡РёРІР°СЋС‚СЃСЏ (${stats.lowStock})` },
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
              <div className="publications-empty-title">Р—Р°РіСЂСѓР·РєР° РїСѓР±Р»РёРєР°С†РёР№...</div>
            </div>
          ) : errorText ? (
            <div className="publications-empty">
              <div className="publications-empty-title">РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ РґР°РЅРЅС‹Рµ</div>
              <div className="publications-empty-text">{errorText}</div>
              {onPickCompany ? (
                <button type="button" className="publication-primary-btn" onClick={onPickCompany}>
                  Р’С‹Р±СЂР°С‚СЊ РґСЂСѓРіСѓСЋ РєРѕРјРїР°РЅРёСЋ
                </button>
              ) : null}
            </div>
          ) : filtered.length === 0 ? (
            <div className="publications-empty">
              <div className="publications-empty-title">РќРёС‡РµРіРѕ РЅРµ РЅР°Р№РґРµРЅРѕ</div>
              <div className="publications-empty-text">РР·РјРµРЅРёС‚Рµ С„РёР»СЊС‚СЂ РёР»Рё РґРѕР±Р°РІСЊС‚Рµ РЅРѕРІСѓСЋ РїСѓР±Р»РёРєР°С†РёСЋ.</div>
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
                          {product.categoryName || "Р‘РµР· РєР°С‚РµРіРѕСЂРёРё"} вЂў {product.unit || "С€С‚"} вЂў РјРёРЅ. Р·Р°РєР°Р· {product.minQty}
                        </div>
                      </div>
                      <div className="publication-status-wrap">
                        <span className={`publication-status ${draft.inStock ? "publication-status--active" : "publication-status--archive"}`}>
                          {draft.inStock ? "Р’ РЅР°Р»РёС‡РёРё" : "РќРµС‚ РІ РЅР°Р»РёС‡РёРё"}
                        </span>
                        {lowStock ? <span className="publication-status publication-status--draft">РњР°Р»Рѕ РѕСЃС‚Р°С‚РєР°</span> : null}
                      </div>
                    </div>

                    <div className="publication-work-grid">
                      <label className="publication-field">
                        <span>Р¦РµРЅР° (СЃРѕРј)</span>
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
                        <span>РќР°Р»РёС‡РёРµ</span>
                        <button
                          type="button"
                          className={`publication-toggle ${draft.inStock ? "is-on" : ""}`}
                          onClick={() => onDraftChange(product.id, { inStock: !draft.inStock })}
                          disabled={busy}
                        >
                          {draft.inStock ? "Р’РєР»СЋС‡РµРЅРѕ" : "Р’С‹РєР»СЋС‡РµРЅРѕ"}
                        </button>
                      </label>

                      <label className="publication-field">
                        <span>РЈС‡РµС‚ СЃРєР»Р°РґР°</span>
                        <button
                          type="button"
                          className={`publication-toggle ${draft.trackInventory ? "is-on" : ""}`}
                          onClick={() => onDraftChange(product.id, { trackInventory: !draft.trackInventory })}
                          disabled={busy}
                        >
                          {draft.trackInventory ? "Р’РєР»СЋС‡РµРЅРѕ" : "Р’С‹РєР»СЋС‡РµРЅРѕ"}
                        </button>
                      </label>

                      <label className="publication-field">
                        <span>РћСЃС‚Р°С‚РѕРє</span>
                        <input
                          inputMode="decimal"
                          value={draft.stockQty}
                          onChange={(e) => onDraftChange(product.id, { stockQty: e.target.value })}
                          disabled={!draft.trackInventory || busy}
                          placeholder={draft.trackInventory ? "0" : "РЈС‡РµС‚ РІС‹РєР»СЋС‡РµРЅ"}
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
                        {savingId === product.id ? "РЎРѕС…СЂР°РЅРµРЅРёРµ..." : "РЎРѕС…СЂР°РЅРёС‚СЊ"}
                      </button>
                      <button
                        type="button"
                        className="publication-danger-btn"
                        disabled={busy}
                        onClick={() => handleDelete(product)}
                      >
                        {deletingId === product.id ? "РЈРґР°Р»РµРЅРёРµ..." : "РЈРґР°Р»РёС‚СЊ"}
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
