import type { DeliveryRecord, OrderSummary, SupplierProduct } from "@usc/core";
import { buildBuyerWorkspaceStats, buildSupplierWorkspaceStats } from "@/screens/homeWorkspace";

describe("home workspace helpers", () => {
  it("builds buyer workspace stats", () => {
    const orders: OrderSummary[] = [
      { id: 1, status: "created" },
      { id: 2, status: "delivered" },
    ];
    expect(
      buildBuyerWorkspaceStats({
        cartLines: 3,
        orders,
        suppliers: 4,
        products: 10,
      })
    ).toEqual([
      { id: "cart", label: "Cart lines", value: "3" },
      { id: "active", label: "Active orders", value: "1" },
      { id: "delivered", label: "Delivered", value: "1" },
      { id: "suppliers", label: "Suppliers", value: "4" },
    ]);
  });

  it("builds supplier workspace stats", () => {
    const inbox: OrderSummary[] = [{ id: 1, status: "created" }, { id: 2, status: "confirmed" }];
    const outbox: OrderSummary[] = [{ id: 3, status: "delivered" }];
    const deliveries: DeliveryRecord[] = [{ id: 1, orderId: 3 }];
    const products: SupplierProduct[] = [
      {
        id: 1,
        supplierCompanyId: 10,
        categoryId: 2,
        name: "Milk",
        description: "",
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
        price: 100,
        unit: "pcs",
        minQty: 1,
        inStock: true,
        trackInventory: true,
        stockQty: 5,
        supplierName: "Supplier",
        categoryName: "Milk",
        createdAt: null,
      },
    ];

    expect(buildSupplierWorkspaceStats({ inbox, outbox, deliveries, products })).toEqual([
      { id: "inbox", label: "Inbox", value: "2" },
      { id: "pending", label: "Pending", value: "1" },
      { id: "deliveries", label: "Deliveries", value: "1" },
      { id: "skus", label: "SKUs", value: "1" },
    ]);
  });
});
