import {
  buildCreatePublicationPayload,
  buildUpdatePublicationPayload,
  filterPublicationProducts,
  isLowStockPublication,
  isPublicationDraftDirty,
  makePublicationDraft,
  mergePublicationDrafts,
  summarizePublicationProducts,
  type PublicationDraft,
} from "@/features/publicationsDraft";
import type { SupplierProduct } from "@usc/core";

function makeProduct(overrides: Partial<SupplierProduct> = {}): SupplierProduct {
  return {
    id: 1,
    supplierCompanyId: 10,
    categoryId: 2,
    name: "Milk",
    description: "Fresh milk",
    shelfLifeDays: null,
    storageCondition: null,
    originCountry: null,
    brand: null,
    manufacturer: null,
    packageType: null,
    netWeightGrams: null,
    allergens: null,
    certifications: null,
    leadTimeDays: null,
    price: 120,
    unit: "pcs",
    minQty: 1,
    inStock: true,
    trackInventory: true,
    stockQty: 14,
    supplierName: "Supplier",
    categoryName: "Milk",
    createdAt: null,
    ...overrides,
  };
}

describe("publications draft helpers", () => {
  it("preserves dirty drafts when server data refreshes", () => {
    const product = makeProduct();
    const dirtyDraft: PublicationDraft = {
      ...makePublicationDraft(product),
      price: "130",
    };

    const merged = mergePublicationDrafts([product], { 1: dirtyDraft });
    expect(merged[1].price).toBe("130");
  });

  it("detects clean drafts correctly", () => {
    const product = makeProduct();
    expect(isPublicationDraftDirty(product, makePublicationDraft(product))).toBe(false);
  });

  it("validates create payload and rejects invalid price", () => {
    const invalid = buildCreatePublicationPayload(10, {
      name: "Milk",
      description: "",
      price: "",
      stockQty: "",
      inStock: true,
      trackInventory: false,
      categoryId: "",
    });

    expect(invalid).toEqual({ ok: false, message: "Price must be a positive number." });
  });

  it("keeps stock untouched when inventory tracking is disabled on update", () => {
    const product = makeProduct();
    const result = buildUpdatePublicationPayload(product, {
      ...makePublicationDraft(product),
      trackInventory: false,
      stockQty: "",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload).not.toHaveProperty("stock_qty", 0);
    }
  });

  it("detects low stock based on draft qty and min qty", () => {
    const product = makeProduct({ minQty: 3, stockQty: 20 });
    expect(
      isLowStockPublication(product, {
        ...makePublicationDraft(product),
        stockQty: "6",
      })
    ).toBe(true);
  });

  it("filters supplier products by search and stock state", () => {
    const milk = makeProduct({ id: 1, name: "Milk", description: "Fresh", inStock: true, categoryName: "Dairy" });
    const bread = makeProduct({ id: 2, name: "Bread", description: "Bakery", inStock: false, categoryName: "Bakery" });

    const filtered = filterPublicationProducts([milk, bread], {}, "bread", "out_stock");
    expect(filtered.map((item) => item.id)).toEqual([2]);
  });

  it("summarizes supplier product stats with draft values", () => {
    const milk = makeProduct({ id: 1, price: 100, stockQty: 5, minQty: 2, inStock: true, trackInventory: true });
    const bread = makeProduct({ id: 2, price: 50, stockQty: null, inStock: false, trackInventory: false });
    const stats = summarizePublicationProducts([milk, bread], {
      1: { ...makePublicationDraft(milk), stockQty: "4", price: "120" },
    });

    expect(stats).toEqual({
      all: 2,
      inStock: 1,
      outOfStock: 1,
      lowStock: 1,
      inventoryValue: 480,
    });
  });
});
