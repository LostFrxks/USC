import type { SupplierProduct } from "@usc/core";

export type PublicationDraft = {
  name: string;
  description: string;
  price: string;
  stockQty: string;
  inStock: boolean;
  trackInventory: boolean;
  categoryId: string;
};

export type PublicationFilter = "all" | "in_stock" | "out_stock" | "low_stock";

export type PublicationStats = {
  all: number;
  inStock: number;
  outOfStock: number;
  lowStock: number;
  inventoryValue: number;
};

export function makePublicationDraft(product: SupplierProduct): PublicationDraft {
  return {
    name: product.name,
    description: product.description,
    price: String(product.price),
    stockQty: product.stockQty == null ? "" : String(product.stockQty),
    inStock: product.inStock,
    trackInventory: product.trackInventory,
    categoryId: product.categoryId == null ? "" : String(product.categoryId),
  };
}

export function makeEmptyPublicationDraft(): PublicationDraft {
  return {
    name: "",
    description: "",
    price: "",
    stockQty: "",
    inStock: true,
    trackInventory: false,
    categoryId: "",
  };
}

function parseNumber(raw: string): number | null {
  const normalized = raw.replace(",", ".").trim();
  if (!normalized) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export function isLowStockPublication(product: SupplierProduct, draft?: PublicationDraft): boolean {
  const trackInventory = draft?.trackInventory ?? product.trackInventory;
  const inStock = draft?.inStock ?? product.inStock;
  const stockQtyText = draft?.stockQty ?? (product.stockQty == null ? "" : String(product.stockQty));
  const stockQty = parseNumber(stockQtyText);
  if (!trackInventory || !inStock || stockQty == null) return false;
  const minQty = Math.max(1, Number(product.minQty || 1));
  return stockQty <= minQty * 2;
}

export function filterPublicationProducts(
  products: SupplierProduct[],
  drafts: Record<number, PublicationDraft>,
  search: string,
  filter: PublicationFilter
): SupplierProduct[] {
  const q = search.trim().toLowerCase();
  return products.filter((product) => {
    const draft = drafts[product.id];
    const name = (draft?.name ?? product.name).toLowerCase();
    const description = (draft?.description ?? product.description).toLowerCase();
    const categoryName = String(product.categoryName ?? "").toLowerCase();
    const matchesSearch = !q || name.includes(q) || description.includes(q) || categoryName.includes(q);
    if (!matchesSearch) return false;

    const inStock = draft?.inStock ?? product.inStock;
    if (filter === "in_stock") return inStock;
    if (filter === "out_stock") return !inStock;
    if (filter === "low_stock") return isLowStockPublication(product, draft);
    return true;
  });
}

export function summarizePublicationProducts(products: SupplierProduct[], drafts: Record<number, PublicationDraft>): PublicationStats {
  return products.reduce<PublicationStats>(
    (acc, product) => {
      const draft = drafts[product.id];
      const inStock = draft?.inStock ?? product.inStock;
      const trackInventory = draft?.trackInventory ?? product.trackInventory;
      const stockQty = parseNumber(draft?.stockQty ?? (product.stockQty == null ? "" : String(product.stockQty)));
      const price = parseNumber(draft?.price ?? String(product.price)) ?? product.price;

      acc.all += 1;
      if (inStock) {
        acc.inStock += 1;
      } else {
        acc.outOfStock += 1;
      }
      if (isLowStockPublication(product, draft)) {
        acc.lowStock += 1;
      }
      if (trackInventory && stockQty != null && stockQty > 0) {
        acc.inventoryValue += stockQty * price;
      }
      return acc;
    },
    { all: 0, inStock: 0, outOfStock: 0, lowStock: 0, inventoryValue: 0 }
  );
}

export function isPublicationDraftDirty(product: SupplierProduct, draft: PublicationDraft): boolean {
  return (
    draft.name.trim() !== product.name ||
    draft.description.trim() !== product.description ||
    parseNumber(draft.price) !== product.price ||
    draft.inStock !== product.inStock ||
    draft.trackInventory !== product.trackInventory ||
    (draft.trackInventory ? parseNumber(draft.stockQty) : null) !== (product.trackInventory ? product.stockQty : null) ||
    (draft.categoryId || "") !== (product.categoryId == null ? "" : String(product.categoryId))
  );
}

export function mergePublicationDrafts(
  products: SupplierProduct[],
  previousDrafts: Record<number, PublicationDraft>
): Record<number, PublicationDraft> {
  return Object.fromEntries(
    products.map((product) => {
      const previous = previousDrafts[product.id];
      if (previous && isPublicationDraftDirty(product, previous)) {
        return [product.id, previous];
      }
      return [product.id, makePublicationDraft(product)];
    })
  );
}

export function buildCreatePublicationPayload(companyId: number, draft: PublicationDraft) {
  const name = draft.name.trim();
  if (!name) return { ok: false as const, message: "Product name is required." };
  const price = parseNumber(draft.price);
  if (price == null || price <= 0) return { ok: false as const, message: "Price must be a positive number." };
  const stockQty = parseNumber(draft.stockQty);
  if (draft.trackInventory && (stockQty == null || stockQty < 0)) {
    return { ok: false as const, message: "Stock quantity must be 0 or greater when inventory tracking is enabled." };
  }

  return {
    ok: true as const,
    payload: {
      supplier_company_id: companyId,
      category_id: draft.categoryId ? Number(draft.categoryId) : undefined,
      name,
      description: draft.description.trim(),
      price,
      unit: "pcs",
      min_qty: 1,
      in_stock: draft.inStock,
      track_inventory: draft.trackInventory,
      stock_qty: draft.trackInventory ? stockQty ?? 0 : undefined,
    },
  };
}

export function buildUpdatePublicationPayload(product: SupplierProduct, draft: PublicationDraft) {
  const name = draft.name.trim();
  if (!name) return { ok: false as const, message: "Product name is required." };
  const price = parseNumber(draft.price);
  if (price == null || price <= 0) return { ok: false as const, message: "Price must be a positive number." };
  const stockQty = parseNumber(draft.stockQty);
  if (draft.trackInventory && (stockQty == null || stockQty < 0)) {
    return { ok: false as const, message: "Stock quantity must be 0 or greater when inventory tracking is enabled." };
  }

  const payload: Record<string, unknown> = {
    name,
    description: draft.description.trim(),
    price,
    in_stock: draft.inStock,
    track_inventory: draft.trackInventory,
    category_id: draft.categoryId ? Number(draft.categoryId) : undefined,
  };

  if (draft.trackInventory) {
    payload.stock_qty = stockQty ?? 0;
  } else if (!draft.trackInventory && product.trackInventory) {
    payload.stock_qty = undefined;
  }

  return { ok: true as const, payload };
}
