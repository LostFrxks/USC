import type { CatalogProduct, CategoryDto, SupplierProduct } from "../types/domain";
import type { Transport } from "../transport/contracts";
import { resolveCatalogImageKey } from "../utils/status";

type CatalogApi = {
  listCategories(): Promise<CategoryDto[]>;
  listProducts(params?: { categoryId?: number; q?: string; supplierId?: number | string }): Promise<CatalogProduct[]>;
  listMySupplierProducts(companyId?: number | null): Promise<SupplierProduct[]>;
  createSupplierProduct(payload: Record<string, unknown>): Promise<SupplierProduct>;
  updateSupplierProduct(productId: number, payload: Record<string, unknown>): Promise<SupplierProduct>;
  deleteSupplierProduct(productId: number): Promise<void>;
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
  price: string | number;
  unit?: string;
  min_qty?: string | number;
  in_stock?: boolean;
  created_at?: string;
  track_inventory?: boolean;
  stock_qty?: string | number | null;
  supplier_name?: string;
  category_name?: string;
};

function toNumber(value: unknown, fallback = 0): number {
  const num = typeof value === "number" ? value : Number(value ?? fallback);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeCatalogProduct(product: ProductApi): CatalogProduct {
  const supplierCompanyId = Number(product.supplier_company_id ?? product.supplier_company);
  const categoryId = product.category_id != null || product.category != null ? Number(product.category_id ?? product.category) : null;
  return {
    id: String(product.id),
    name: product.name,
    description: String(product.description ?? ""),
    shelfLifeDays:
      product.shelf_life_days == null ? null : Number.isFinite(Number(product.shelf_life_days)) ? Number(product.shelf_life_days) : null,
    storageCondition: product.storage_condition == null ? null : String(product.storage_condition),
    originCountry: product.origin_country == null ? null : String(product.origin_country),
    brand: product.brand == null ? null : String(product.brand),
    manufacturer: product.manufacturer == null ? null : String(product.manufacturer),
    packageType: product.package_type == null ? null : String(product.package_type),
    netWeightGrams:
      product.net_weight_grams == null ? null : Number.isFinite(Number(product.net_weight_grams)) ? Number(product.net_weight_grams) : null,
    allergens: product.allergens == null ? null : String(product.allergens),
    certifications: product.certifications == null ? null : String(product.certifications),
    leadTimeDays: product.lead_time_days == null ? null : Number.isFinite(Number(product.lead_time_days)) ? Number(product.lead_time_days) : null,
    seller: product.supplier_name ?? `Supplier #${product.supplier_company_id ?? product.supplier_company ?? "?"}`,
    price: Number(product.price ?? 0),
    rating: "4.8",
    reviews: 10,
    categoryKey: resolveCatalogImageKey({ categoryId, categoryName: product.category_name ?? null }),
    supplierCompanyId: Number.isFinite(supplierCompanyId) ? supplierCompanyId : undefined,
    categoryId: categoryId != null && Number.isFinite(categoryId) ? categoryId : null,
  };
}

function normalizeSupplierProduct(product: ProductApi): SupplierProduct {
  return {
    id: toNumber(product.id),
    supplierCompanyId: product.supplier_company_id != null || product.supplier_company != null ? toNumber(product.supplier_company_id ?? product.supplier_company) : null,
    categoryId: product.category_id != null || product.category != null ? toNumber(product.category_id ?? product.category) : null,
    name: String(product.name ?? "").trim(),
    description: String(product.description ?? ""),
    shelfLifeDays: product.shelf_life_days == null ? null : toNumber(product.shelf_life_days),
    storageCondition: product.storage_condition == null ? null : String(product.storage_condition),
    originCountry: product.origin_country == null ? null : String(product.origin_country),
    brand: product.brand == null ? null : String(product.brand),
    manufacturer: product.manufacturer == null ? null : String(product.manufacturer),
    packageType: product.package_type == null ? null : String(product.package_type),
    netWeightGrams: product.net_weight_grams == null ? null : toNumber(product.net_weight_grams),
    allergens: product.allergens == null ? null : String(product.allergens),
    certifications: product.certifications == null ? null : String(product.certifications),
    leadTimeDays: product.lead_time_days == null ? null : toNumber(product.lead_time_days),
    price: toNumber(product.price),
    unit: String(product.unit ?? ""),
    minQty: toNumber(product.min_qty, 1),
    inStock: Boolean(product.in_stock ?? true),
    trackInventory: Boolean(product.track_inventory ?? false),
    stockQty: product.stock_qty == null ? null : toNumber(product.stock_qty, 0),
    supplierName: product.supplier_name ?? null,
    categoryName: product.category_name ?? null,
    createdAt: product.created_at ?? null,
  };
}

export function createCatalogApi(transport: Transport): CatalogApi {
  return {
    async listCategories() {
      const data = await transport.request<{ results: Array<{ id: number; name: string }> }>("/categories/");
      return (data.results ?? []).map((category) => ({ id: category.id, name: category.name }));
    },

    async listProducts(params) {
      const qs = new URLSearchParams();
      if (params?.q) qs.set("search", params.q);
      if (params?.categoryId) qs.set("category", String(params.categoryId));
      if (params?.supplierId) qs.set("supplier_company", String(params.supplierId));
      const url = qs.toString() ? `/products/?${qs.toString()}` : "/products/";
      const data = await transport.request<{ results: ProductApi[] }>(url);
      return (data.results ?? []).map(normalizeCatalogProduct);
    },

    async listMySupplierProducts(companyId) {
      const qs = new URLSearchParams();
      if (companyId != null && Number.isFinite(companyId)) {
        qs.set("company_id", String(companyId));
      }
      const url = qs.toString() ? `/products/my_supplier_products/?${qs.toString()}` : "/products/my_supplier_products/";
      const rows = await transport.request<ProductApi[]>(url, { auth: true });
      return (rows ?? []).map(normalizeSupplierProduct);
    },

    async createSupplierProduct(payload) {
      const row = await transport.request<ProductApi>("/products/", { method: "POST", auth: true, body: payload });
      return normalizeSupplierProduct(row);
    },

    async updateSupplierProduct(productId, payload) {
      const row = await transport.request<ProductApi>(`/products/${productId}/`, { method: "PATCH", auth: true, body: payload });
      return normalizeSupplierProduct(row);
    },

    deleteSupplierProduct(productId) {
      return transport.request<void>(`/products/${productId}/`, { method: "DELETE", auth: true });
    },
  };
}
