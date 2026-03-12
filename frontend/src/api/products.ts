import { api } from "./client";
import type { Product } from "../types";

type ApiPage<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

type ProductApi = {
  id: number | string;
  supplier_company?: number | string | null;
  supplier_company_id?: number | string | null;
  category?: number | string | null;
  category_id?: number | string | null;
  name: string;
  description?: string;
  shelf_life_days?: number | null;
  storage_condition?: string | null;
  origin_country?: string | null;
  brand?: string | null;
  manufacturer?: string | null;
  package_type?: string | null;
  net_weight_grams?: number | string | null;
  allergens?: string | null;
  certifications?: string | null;
  lead_time_days?: number | null;
  price: string;
  unit?: string;
  min_qty?: string;
  in_stock?: boolean;
  created_at?: string;
  track_inventory?: boolean;
  stock_qty?: string;

  supplier_name?: string;
  category_name?: string;
};

export type SupplierProduct = {
  id: number;
  supplierCompanyId: number | null;
  categoryId: number | null;
  name: string;
  description: string;
  shelfLifeDays: number | null;
  storageCondition: string | null;
  originCountry: string | null;
  brand: string | null;
  manufacturer: string | null;
  packageType: string | null;
  netWeightGrams: number | null;
  allergens: string | null;
  certifications: string | null;
  leadTimeDays: number | null;
  price: number;
  unit: string;
  minQty: number;
  inStock: boolean;
  trackInventory: boolean;
  stockQty: number | null;
  supplierName: string | null;
  categoryName: string | null;
  createdAt: string | null;
};

export type CreateSupplierProductPayload = {
  supplier_company_id: number;
  category_id?: number | null;
  name: string;
  description?: string;
  shelf_life_days?: number | null;
  storage_condition?: string | null;
  origin_country?: string | null;
  brand?: string | null;
  manufacturer?: string | null;
  package_type?: string | null;
  net_weight_grams?: number | null;
  allergens?: string | null;
  certifications?: string | null;
  lead_time_days?: number | null;
  price: number;
  unit?: string;
  min_qty?: number;
  in_stock?: boolean;
  track_inventory?: boolean;
  stock_qty?: number | null;
};

export type UpdateSupplierProductPayload = {
  category_id?: number;
  name?: string;
  description?: string;
  shelf_life_days?: number | null;
  storage_condition?: string | null;
  origin_country?: string | null;
  brand?: string | null;
  manufacturer?: string | null;
  package_type?: string | null;
  net_weight_grams?: number | null;
  allergens?: string | null;
  certifications?: string | null;
  lead_time_days?: number | null;
  price?: number;
  unit?: string;
  min_qty?: number;
  in_stock?: boolean;
  track_inventory?: boolean;
  stock_qty?: number;
};

const LIST_PRODUCTS = "/products/";
const MY_SUPPLIER_PRODUCTS = "/products/my_supplier_products/";
const PRODUCTS_TTL_MS = 60 * 1000;
const productsCache = new Map<string, { data: Product[]; expiresAt: number }>();
const productsInFlight = new Map<string, Promise<Product[]>>();

function pickImage(p: ProductApi, categoryId: number | null): string {
  const key = String(p.category_name || "").toLowerCase();
  const byCategory: Record<string, string[]> = {
    meat: ["/media/card_meat1.jpg", "/media/card_meat2.jpg", "/media/card_meat3.jpg"],
    milk: ["/media/card_milk1.jpg", "/media/card_milk2.jpg", "/media/card_milk3.jpg"],
    fish: ["/media/card_fish1.jpg", "/media/card_fish2.jpg", "/media/card_fish3.jpg"],
    bread: ["/media/card_bread1.jpg", "/media/card_bread2.jpg", "/media/card_bread3.jpg"],
    fruit: ["/media/card_fruit1.jpg", "/media/card_fruit2.jpg", "/media/card_fruit3.jpg"],
    grain: ["/media/card_grain1.jpg", "/media/card_grain2.jpg", "/media/card_grain3.jpg"],
  };
  const fallbackById: Record<number, string[]> = {
    1: byCategory.meat,
    2: byCategory.milk,
    3: byCategory.fish,
    4: byCategory.bread,
    5: byCategory.fruit,
    6: byCategory.grain,
  };
  const bucket =
    byCategory[key] ??
    (categoryId != null ? fallbackById[categoryId] : undefined) ??
    ["/media/card_meat1.jpg", "/media/card_milk1.jpg", "/media/card_fish1.jpg"];
  const pid = Number(p.id);
  const index = Number.isFinite(pid) ? Math.abs(pid) % bucket.length : 0;
  return bucket[index];
}

function normalize(p: ProductApi): Product {
  const rawSupplierCompany = p.supplier_company_id ?? p.supplier_company;
  const rawCategory = p.category_id ?? p.category;
  const supplierCompanyId = Number(rawSupplierCompany);
  const categoryId = rawCategory != null ? Number(rawCategory) : null;

  return {
    id: String(p.id),
    name: p.name,
    description: String(p.description ?? ""),
    shelf_life_days:
      p.shelf_life_days == null ? null : Number.isFinite(Number(p.shelf_life_days)) ? Number(p.shelf_life_days) : null,
    storage_condition: p.storage_condition == null ? null : String(p.storage_condition),
    origin_country: p.origin_country == null ? null : String(p.origin_country),
    brand: p.brand == null ? null : String(p.brand),
    manufacturer: p.manufacturer == null ? null : String(p.manufacturer),
    package_type: p.package_type == null ? null : String(p.package_type),
    net_weight_grams:
      p.net_weight_grams == null ? null : Number.isFinite(Number(p.net_weight_grams)) ? Number(p.net_weight_grams) : null,
    allergens: p.allergens == null ? null : String(p.allergens),
    certifications: p.certifications == null ? null : String(p.certifications),
    lead_time_days: p.lead_time_days == null ? null : Number.isFinite(Number(p.lead_time_days)) ? Number(p.lead_time_days) : null,
    seller: p.supplier_name ?? `Supplier #${rawSupplierCompany ?? "?"}`,
    price: Number(p.price ?? 0),
    rating: "4.8",
    reviews: 10,
    image: pickImage(p, categoryId),
    category: "meat",
    supplier_company_id: Number.isFinite(supplierCompanyId) ? supplierCompanyId : undefined,
    category_id: categoryId != null && Number.isFinite(categoryId) ? categoryId : null,
  };
}

function toNumber(value: unknown, fallback = 0): number {
  const num = typeof value === "number" ? value : Number(value ?? fallback);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeSupplierProduct(raw: ProductApi): SupplierProduct {
  const supplierCompanyRaw = raw.supplier_company_id ?? raw.supplier_company ?? null;
  const categoryRaw = raw.category_id ?? raw.category ?? null;
  const stockRaw = raw.stock_qty ?? null;

  return {
    id: toNumber(raw.id),
    supplierCompanyId: supplierCompanyRaw != null ? toNumber(supplierCompanyRaw) : null,
    categoryId: categoryRaw != null ? toNumber(categoryRaw) : null,
    name: String(raw.name ?? "").trim(),
    description: String(raw.description ?? ""),
    shelfLifeDays:
      raw.shelf_life_days == null
        ? null
        : Number.isFinite(Number(raw.shelf_life_days))
          ? Number(raw.shelf_life_days)
          : null,
    storageCondition: raw.storage_condition == null ? null : String(raw.storage_condition),
    originCountry: raw.origin_country == null ? null : String(raw.origin_country),
    brand: raw.brand == null ? null : String(raw.brand),
    manufacturer: raw.manufacturer == null ? null : String(raw.manufacturer),
    packageType: raw.package_type == null ? null : String(raw.package_type),
    netWeightGrams:
      raw.net_weight_grams == null ? null : Number.isFinite(Number(raw.net_weight_grams)) ? Number(raw.net_weight_grams) : null,
    allergens: raw.allergens == null ? null : String(raw.allergens),
    certifications: raw.certifications == null ? null : String(raw.certifications),
    leadTimeDays:
      raw.lead_time_days == null ? null : Number.isFinite(Number(raw.lead_time_days)) ? Number(raw.lead_time_days) : null,
    price: toNumber(raw.price, 0),
    unit: String(raw.unit ?? ""),
    minQty: toNumber(raw.min_qty, 1),
    inStock: Boolean(raw.in_stock ?? true),
    trackInventory: Boolean(raw.track_inventory ?? false),
    stockQty: stockRaw == null ? null : toNumber(stockRaw, 0),
    supplierName: raw.supplier_name ?? null,
    categoryName: raw.category_name ?? null,
    createdAt: raw.created_at ?? null,
  };
}

export async function fetchProducts(params?: {
  categoryId?: number;
  q?: string;
  supplierId?: number | string;
}): Promise<Product[]> {
  const qs = new URLSearchParams();

  if (params?.q) qs.set("search", params.q);
  if (params?.categoryId) qs.set("category", String(params.categoryId));
  if (params?.supplierId) qs.set("supplier_company", String(params.supplierId));

  const url = qs.toString() ? `${LIST_PRODUCTS}?${qs.toString()}` : LIST_PRODUCTS;
  const now = Date.now();
  const cached = productsCache.get(url);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const pending = productsInFlight.get(url);
  if (pending) {
    return pending;
  }

  const request = api<ApiPage<ProductApi>>(url, { auth: false })
    .then((page) => {
      const normalized = page.results.map(normalize);
      productsCache.set(url, { data: normalized, expiresAt: Date.now() + PRODUCTS_TTL_MS });
      return normalized;
    })
    .finally(() => {
      productsInFlight.delete(url);
    });

  productsInFlight.set(url, request);
  return request;
}

export async function fetchMySupplierProducts(companyId?: number | null): Promise<SupplierProduct[]> {
  const qs = new URLSearchParams();
  if (companyId != null && Number.isFinite(companyId)) {
    qs.set("company_id", String(companyId));
  }
  const url = qs.toString() ? `${MY_SUPPLIER_PRODUCTS}?${qs.toString()}` : MY_SUPPLIER_PRODUCTS;
  const rows = await api<ProductApi[]>(url, { auth: true });
  return (rows ?? []).map(normalizeSupplierProduct);
}

export async function createSupplierProduct(payload: CreateSupplierProductPayload): Promise<SupplierProduct> {
  const row = await api<ProductApi>(LIST_PRODUCTS, { method: "POST", auth: true, body: payload });
  return normalizeSupplierProduct(row);
}

export async function updateSupplierProduct(
  productId: number,
  payload: UpdateSupplierProductPayload
): Promise<SupplierProduct> {
  const row = await api<ProductApi>(`${LIST_PRODUCTS}${productId}/`, {
    method: "PATCH",
    auth: true,
    body: payload,
  });
  return normalizeSupplierProduct(row);
}

export async function deleteSupplierProduct(productId: number): Promise<void> {
  await api<void>(`${LIST_PRODUCTS}${productId}/`, { method: "DELETE", auth: true });
}
