import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchProducts } from "./products";

function productListResponse(results: unknown[]) {
  return new Response(
    JSON.stringify({
      count: results.length,
      next: null,
      previous: null,
      results,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}

describe("products api normalization", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves category from backend payload instead of hardcoding meat", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        productListResponse([
          {
            id: 11,
            name: "Milk",
            price: "55",
            category_id: 2,
            category_name: "milk",
            supplier_company_id: 7,
            supplier_name: "Dairy Co",
          },
        ])
      )
    );

    const products = await fetchProducts({ q: "category-milk-check" });

    expect(products[0]).toMatchObject({
      id: "11",
      category: "milk",
      seller: "Dairy Co",
    });
  });

  it("does not inject fake rating and review fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        productListResponse([
          {
            id: 21,
            name: "Bread",
            price: "30",
            category_id: 4,
            supplier_company_id: 9,
          },
        ])
      )
    );

    const products = await fetchProducts({ q: "no-fake-rating-check" });

    expect(products[0]).not.toHaveProperty("rating");
    expect(products[0]).not.toHaveProperty("reviews");
    expect(products[0].category).toBe("bread");
  });
});
