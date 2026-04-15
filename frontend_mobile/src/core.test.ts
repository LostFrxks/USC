import { appendGeoTag, parseGeoTag, stripGeoTag, validateSingleSupplierCart } from "@usc/core";

describe("shared core helpers", () => {
  it("round-trips geo tag through comment helpers", () => {
    const comment = appendGeoTag("Deliver after lunch", { lat: 42.8746, lng: 74.5698 });
    expect(comment).toContain("[geo:");
    expect(parseGeoTag(comment)).toEqual({ lat: 42.8746, lng: 74.5698 });
    expect(stripGeoTag(comment)).toBe("Deliver after lunch");
  });

  it("guards mixed-supplier carts", () => {
    const result = validateSingleSupplierCart([
      {
        product: {
          id: "1",
          name: "Milk",
          seller: "Supplier A",
          price: 10,
          rating: "4.8",
          reviews: 10,
          categoryKey: "milk",
          supplierCompanyId: 1,
        },
        qty: 1,
      },
      {
        product: {
          id: "2",
          name: "Bread",
          seller: "Supplier B",
          price: 8,
          rating: "4.8",
          reviews: 10,
          categoryKey: "bread",
          supplierCompanyId: 2,
        },
        qty: 1,
      },
    ]);

    expect(result).toEqual({ ok: false, reason: "multiple_suppliers" });
  });
});
